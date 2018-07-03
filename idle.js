// ==UserScript==
// @name		Ensingm2 SGI
// @namespace	https://github.com/ensingm2/saliengame_idler
// @version		0.0.23.2
// @author		ensingm2 + JeanPaulLucien mods
// @match		*://steamcommunity.com/saliengame/play
// @match		*://steamcommunity.com/saliengame/play/
// @grant		none
// ==/UserScript==

// This is the zone you want to attack (Optional, otherwise picks one for you).
var target_zone = -1;

// Variables. Don't change these unless you know what you're doing.
var real_round_length = 120; // Round Length of a real game (In Seconds, for calculating score)
var resend_frequency = 110; // Frequency at which we can say we finished a round (May be different than real length)
var update_length = 1; // How long to wait between updates (In Seconds)
var loop_rounds = true;
var language = "english"; // Used when POSTing scores
var access_token = "";
// Used to get data back in boss battles; ;
// Timestamp for when the current game started; ; ;
// Last time we updated the grid (to avoid too frequent calls)
// Check the state of the game script and unlock it if needed (setInterval)
var account_id = undefined, current_game_id = undefined, current_game_start = undefined, current_timeout = undefined, current_planet_id = undefined, last_update_grid = undefined, check_game_state = undefined;
var time_passed_ms = 0;
var max_retry = 5; // Max number of retries to send requests
var auto_first_join = true; // Automatically join the best zone at first
var auto_switch_planet = {
	"active": true, // Automatically switch to the best planet available (true : yes, false : no)
	"current_difficulty": undefined
};
var gui; //local gui variable
var start_button = false; // is start button already pressed?
var animations_enabled = true;
var boss_options = {
	"update_freq": 5, // Number of seconds between calls to ReportBossDamage
	"report_interval": undefined,
	"error_count": 0,
	"last_heal": undefined,
	"last_report": undefined, // Used in the check of the game script state and unlock it if needed
    "current_max_hp": undefined,
    "totally_max_hp": 100000000 // The most fat boss
	"previous_hp: //
}
var current_game_is_boss = false; // State if we're entering / in a boss battle or not

// Xtreme options
function funcOnlyGame() {
  var hide = [];
  hide[0] = document.getElementById("global_header");
  hide[1] = document.getElementById("footer");
  hide[2] = document.getElementsByClassName("salien_section");
  hide[3] = document.getElementsByClassName("salien_backstory");

  // If the checkbox is checked, display the output text
  if (document.getElementById("xtremeCheck1").checked == true) {
    hide.style.display = "none";
  } else {
    hide.style.display = "";
  }
}

var xtremeScriptTitle = '<h2>Salien Game Idler</h2>';
var xtremeAuthor = '<span>Xtreme settings by JPL: </span>';
var xtremeCheck1 = '<input id="stayOnlyGame" type="checkbox" title="Stay only the game on the page">'; // onclick = "stayOnlyGame()"

var xtremeDiv = document.createElement('div');
    xtremeDiv.className = "sab_xtremeOptions";
    xtremeDiv.innerHTML = xtremeScriptTitle + xtremeAuthor + xtremeCheck1;

var xtremeStyle = document.createElement('style');
    xtremeStyle.innerHTML = ".sab_xtremeOptions {margin: 0 auto;text-align: center;padding: 10px 0;}";
    xtremeDiv.appendChild(xtremeStyle, xtremeDiv);

document.body.insertBefore(xtremeDiv, document.body.firstChild);

document.getElementById('stayOnlyGame').checked = false;
document.getElementById('stayOnlyGame').onclick = function () {
    var hide = ['global_header', 'footer', 'salien_section', 'salien_backstory'];
    var hideThis;
    for (var i = 0; i < hide.length; i ++)
    {
        if(document.getElementById(hide[i])) {
            hideThis = document.getElementById(hide[i]);
            if (!this.checked) hideThis.style.display = 'block'; else hideThis.style.display = 'none';
        } else {
            hideThis = document.getElementsByClassName(hide[i]);
            for(var item of hideThis)
            {
                if (!this.checked) item.style.display = 'block'; else item.style.display = 'none';
            }
        }
    }
}
// var stay_only_game_css = '#header, #footer, .salien_backhistory, .salien_section { display:none;}';

class BotGUI {
	constructor(state) {
		console.log('GUI Has been created');

		this.state = state;

		this.createStatusWindow();
		this.createProgressBar();
	}

	createStatusWindow()
	{
		if(document.getElementById('salienbot_gui'))
		{
			return false;
		}
		var $statusWindow = $J([
			'<style>#salienbot_gui {padding: 5px 5px 10px 15px; font-size: .85em; width: 250px; position: absolute; height: 2em; overflow-y: hidden;transition: 1s;} div#salienbot_gui:hover {height: auto; background: linear-gradient(to Bottom, #222 92%, transparent);} p#sab_status{margin-top: -.8em; font-size: .8em;} #salienbot_gui p{margin_top: .2em}</style><div id="salienbot_gui">',
				'<h2><a href="https://github.com/ensingm2/saliengame_idler">Salien Game Idler</a></h2>',
				'<p id="sab_status"></p>', // Running or stopped
				'<p><b>Task: </b><span id="sab_task">Initializing</span></p>', // Current task
				`<p><b>Target Zone: </b><span id="sab_zone">None</span></p>`,
				`<p style="display:none" id="sab_zone_difficulty_div"><b>Zone Difficulty:</b> <span id="sab_zone_difficulty"></span> <span id="sab_zone_score"></span></p>`, // why? It's not visible
				'<p><b>Level: </b><span id="sab_level">'+ this.state.level +'</span><b> EXP: </b><span id="sab_exp">'+ this.state.exp +" / "+ this.state.next_level_exp +'</span></p>',
				'<p><b>Lvl Up In: </b><input id="lvlupCheckbox" type="checkbox"><span id="sab_lvlup"></span></p>',
				'<p><input id="planetSwitchCheckbox" type="checkbox">Automatic Planet Switching</p>',
				'<p><input id="animationsCheckbox" type="checkbox">Hide Game (Improves Performance)</p>',
			'</div>'
		].join(''))

		$J('#salien_game_placeholder').append( $statusWindow )
	}

	createProgressBar() {
		this.progressbar = new CProgressBar(63);
		this.progressbar.x = 2
		this.progressbar.y = 48
	}

	updateStatus(running) {
		const statusTxt = running ? '<span style="color: green;">✓ Running</span>' : '<span style="color: red;">✗ Stopped</span>';

		$J('#sab_status').html(statusTxt);
	}

	updateTask(status, log_to_console) {
		if(log_to_console || log_to_console === undefined)
			console.log(status);
		document.getElementById('sab_task').innerText = status;
	}

	updateExp(exp) {
		document.getElementById('sab_exp').innerText = exp;
	}

	updateLevel(level) {
		document.getElementById('sab_level').innerText = level;
	}

	updateEstimatedTime(secondsLeft) {
		if (secondsLeft == 0) {
			document.getElementById('sab_lvlup').innerText = "Max level";
			return;
		}
        if(secondsLeft == null) {
            document.getElementById('sab_lvlup').innerText = "Disabled";
            return;
        }
		let date = new Date(null);
		date.setSeconds(secondsLeft);
		var result = date.toISOString().substr(8, 11).split(/[T:]/);

		var days = result[0]-1;
		var hours = result[1];
		var minutes = result[2];
		var seconds = result[3];

        // Here is no seconds
		var timeTxt = "";
		if(days > 0)
			timeTxt += days + "d ";
		if(hours > 0 || timeTxt.length > 0)
			timeTxt += hours + "h ";
		if(minutes > 0 || timeTxt.length > 0)
			timeTxt += minutes + "m ";
		//timeTxt += seconds + "s";
		document.getElementById('sab_lvlup').innerText = timeTxt;
	}

	updateZone(zone, progress, difficulty, is_boss_battle) {
		var printString = zone;
		if(is_boss_battle === undefined)
			is_boss_battle = false;
		if(progress === undefined && !is_boss_battle) {
			$J("#sab_zone_difficulty_div").hide();
			difficulty = "";
		}
		else {
			$J("#sab_zone_difficulty_div").show();
			gGame.m_State.m_Grid.m_Tiles[target_zone].addChild(this.progressbar);

			if(is_boss_battle) {
				$J("#sab_zone_score").hide();
				document.getElementById('sab_zone_difficulty').innerText = "[BOSS]";
			}
			else {
				$J("#sab_zone_score").show();
				document.getElementById('sab_zone_score').innerText = "(" + get_max_score(zone) + "xp/round)";

				document.getElementById('sab_zone_difficulty').innerText = difficulty;
				printString += " (" + (progress * 100).toFixed(2) + "% Complete)"
			}
		}

		document.getElementById('sab_zone').innerText = printString;
	}
};

function initGUI(){
	if (!gGame.m_State || gGame.m_State instanceof CBootState || gGame.m_IsStateLoading){
		if(gGame.m_State && !gGame.m_IsStateLoading && !start_button){
			start_button = true;
			console.log("clicking button");
			gGame.m_State.button.click();
		}
		setTimeout(function() { initGUI(); }, 100);
	} else {
		console.log(gGame);
		gui = new BotGUI({
			level: gPlayerInfo.level,
			exp: gPlayerInfo.score,
			next_level_exp: (gPlayerInfo.next_level_score !== undefined) ? gPlayerInfo.next_level_score : "Infinite"
		});

		// Set our onclicks

		$J('#animationsCheckbox').change(function() {
			INJECT_toggle_animations(!this.checked);
		});
		$J('#animationsCheckbox').prop('checked', !animations_enabled);

		$J('#planetSwitchCheckbox').change(function() {
			auto_switch_planet.active = this.checked;
		});
		$J('#planetSwitchCheckbox').prop('checked', auto_switch_planet.active);


		// Run the global initializer, which will call the function for whichever screen you're in
		INJECT_init();
	}
};

function calculateTimeToNextLevel() {
	if(gPlayerInfo.level == 25)
		return 0;
    if(!$J('#lvlupCheckbox').prop('checked'))
        return null;

	const nextScoreAmount = get_max_score(target_zone);
	const roundTime = resend_frequency + update_length;
	const secondsLeft = Math.ceil((gPlayerInfo.next_level_score - gPlayerInfo.score) / nextScoreAmount) * roundTime - Math.ceil(time_passed_ms / 1000); // * 120
	// окр. вверх до целого(float(int(значение опыта для след. уровня - сколько сейчас опыта) / опыта с зоны)) * 120 секунд
	return secondsLeft;
}

// Handle AJAX errors to avoid the script to be locked by a single API error
function ajaxErrorHandling(ajaxObj, params, messagesArray) {
	ajaxObj.tryCount++;
	if (ajaxObj.tryCount <= ajaxObj.retryLimit) {
		var currentTask = "Retrying in 5s to " + messagesArray[0] + " (Retry #" + ajaxObj.tryCount + "). Error: " + params.xhr.status + ": " + params.thrownError;
		gui.updateTask(currentTask);
		setTimeout(function() { $J.ajax(ajaxObj); }, 5000);
	}
	else {
		var currentTask = "Error " + messagesArray[1] + ": " + params.xhr.status + ": " + params.thrownError + " (Max retries reached).";
		gui.updateTask(currentTask);
	}
}

// Check the state of the game script and unlock it if needed
function checkUnlockGameState() {
	if (current_game_start === undefined || (current_game_is_boss == true && boss_options.last_report === undefined))
		return;
	var now = new Date().getTime();
	if (current_game_is_boss) {
		var timeDiff = (now - boss_options.last_report) / 1000;
	} else {
		var timeDiff = (now - current_game_start) / 1000;
	}
	var maxWait = 300; // Time (in seconds) to wait until we try to unlock the script
	if (timeDiff < maxWait)
		return;
	gui.updateTask("Detected the game script is locked. Trying to unlock it.");
	if (auto_switch_planet.active == true) {
		CheckSwitchBetterPlanet(true);
	} else {
		SwitchNextZone(0, true);
	}
}

// Grab the user's access token
var INJECT_get_access_token = function() {
    console.log('Try to get access token');
	$J.ajax({
		async: false,
		type: "GET",
		url: "https://steamcommunity.com/saliengame/gettoken",
		success: function(data) {
			if(data.token != undefined) {
				console.log("Got access token: " + data.token);
				access_token = data.token;
			}
			else {
				console.log("Failed to retrieve access token.")
				access_token = undefined;
			}
		}
	});
}

// Make the call to start a round, and kick-off the idle process
var INJECT_start_round = function(zone, access_token, attempt_no, is_boss_battle) {
	if(attempt_no === undefined)
		attempt_no = 0;
	if(is_boss_battle === undefined)
		is_boss_battle = false;

	// Leave the game if we're already in one.
	if(current_game_id !== undefined) {
		gui.updateTask("Previous game detected. Ending it.", true);
		INJECT_leave_round();
	}

	var postURL = "https://community.steam-api.com/ITerritoryControlMinigameService/JoinZone/v0001/";
	if(is_boss_battle)
		postURL = "https://community.steam-api.com/ITerritoryControlMinigameService/JoinBossZone/v0001/"
	// Send the POST to join the game.
	$J.ajax({
		async: false,
		type: "POST",
		url: postURL,
		data: { access_token: access_token, zone_position: zone },
		tryCount : 0,
		retryLimit : max_retry,
		success: function(data, textStatus, jqXHR) {
			if( $J.isEmptyObject(data.response) ) {
				// Check if the zone is completed
				INJECT_update_grid(false); // Error handling set to false to avoid too much parallel calls with the setTimeout below
				if(window.gGame.m_State.m_Grid.m_Tiles[zone].Info.captured || attempt_no >= max_retry) {
					if (auto_switch_planet.active == true)
						CheckSwitchBetterPlanet();
					else
						SwitchNextZone();
				}
				else {
					// Check header error for an eventual lock inside a game area
					var errorId = jqXHR.getResponseHeader('x-eresult');
					if (errorId == 11) {
						var gameIdStuck = jqXHR.getResponseHeader('x-error_message').match(/\d+/)[0];

						console.log("Game has ended. Leaving it.");
						current_game_id = gameIdStuck;
						INJECT_leave_round();
					} else {
						console.log("Error getting zone response (on start):",data);
					}
					gui.updateTask("Waiting 5s and re-sending join attempt (Attempt #" + (attempt_no + 1) + ").");
					clearTimeout(current_timeout);
					current_timeout = setTimeout(function() { INJECT_start_round(zone, access_token, attempt_no+1, current_game_is_boss); }, 5000);
				}
			}
			else {
				console.log("Round successfully started in zone #" + zone);
				console.log(data);

				// Set target
				target_zone = zone;
				current_game_is_boss = window.gGame.m_State.m_Grid.m_Tiles[target_zone].Info.boss;

				// Update the GUI
				gui.updateStatus(true);
				gui.updateZone(zone, data.response.zone_info.capture_progress, data.response.zone_info.difficulty, is_boss_battle);
                gui.updateEstimatedTime(calculateTimeToNextLevel());

				current_game_id = data.response.zone_info.gameid;
				current_game_start = new Date().getTime();

				if (auto_switch_planet.active == true) {
					auto_switch_planet.current_difficulty = data.response.zone_info.difficulty;
					if (!is_boss_battle)
						CheckSwitchBetterPlanet(true);
				}

				if(is_boss_battle) {
					boss_options.error_count = 0;
					boss_options.report_interval = setInterval(function() { INJECT_report_boss_damage(); }, boss_options.update_freq*1000);
				} else {
					INJECT_wait_for_end(resend_frequency);
				}
			}
		},
		error: function (xhr, ajaxOptions, thrownError) {
			var messagesArray = ["start the round", "starting round"];
			var ajaxParams = {
				xhr: xhr,
				ajaxOptions: ajaxOptions,
				thrownError: thrownError
			};
			ajaxErrorHandling(this, ajaxParams, messagesArray);
		}
	});
}

var INJECT_report_boss_damage = function() { function success(results) {
	boss_options.last_report = new Date().getTime();
		if (results.response.waiting_for_players == true) {
			gui.updateTask("Waiting for players...");
		} else {
			results.response.boss_status.boss_players.forEach( function(player) {
				if (player.accountid == account_id) {
					if (player.time_last_heal !== undefined)
						boss_options.last_heal = player.time_last_heal;

					if (player.hp > 0) {
						gui.updateTask("In boss battle. Boss HP left: " + results.response.boss_status.boss_hp + ". EXP earned: " + player.xp_earned + ". HP left: " + player.hp);
						if (results.response.boss_status.boss_hp == 0 || results.response.game_over) {
							end_game();
						}
					} else {
						gui.updateTask("You died, ending boss fight. Boss HP left: " + results.response.boss_status.boss_hp + ". EXP earned: " + player.xp_earned);
						end_game();
					}
				}
			});
			gui.progressbar.SetValue((results.response.boss_status.boss_max_hp - results.response.boss_status.boss_hp) / results.response.boss_status.boss_max_hp);
            if (boss_options.current_max_hp === undefined)
				boss_options.current_max_hp = results.response.boss_status.boss_max_hp;

		}
	}
	function error(results, eresult) {
		if (eresult == 11 || boss_options.error_count >= max_retry)
			end_game();
		else
			boss_options.error_count++;
	}
	function end_game() {
		gui.updateTask("Boss battle finished. Searching a new planet / zone.");
		clearInterval(boss_options.report_interval);
		boss_options.report_interval = undefined;
		boss_options.last_heal = undefined;
		boss_options.last_report = undefined;
        boss_options.current_max_hp = undefined;
		current_game_is_boss = false;
		INJECT_leave_round();

		if (auto_switch_planet.active == true)
			CheckSwitchBetterPlanet();
		else
			SwitchNextZone();
	}

	// Up-to-date damage method
	if(!Number.isInteger(boss_options.previous_hp))
		boss_options.previous_hp = results.response.boss_status.boss_hp;

	var delta_boss_hp = boss_options.previous_hp - results.response.boss_status.boss_hp + 10000;
	var damageDone = Math.ceil(Math.atan(10000/delta_boss_hp + 0.02) * 1000 / (1 / (26 - gPlayerInfo.level) + 0.46);
	// = 1/(26,8-J24)+0,46 =1/(26-J24)+0,46 = Math.atan(gPlayerInfo.level - 0.57 * gPlayerInfo.level
	
	/* Old damage method
	var percentHP = 1;
	if(boss_options.current_max_hp !== undefined) {
		if(boss_options.current_max_hp > boss_options.totally_max_hp) 
			boss_options.totally_max_hp = boss_options.current_max_hp;
		percentHP = Math.floor(boss_options.current_max_hp / boss_options.totally_max_hp); results.response.boss_status.boss_hp
	}
	var damageDone = Math.floor(Math.random(1,25) * percentHP / gPlayerInfo.level); */
							   
    console.log('Your damage: ' + damageDone + ' With next options. PercentHP: ' + percentHP + ' Curmaxhp: ' + boss_options.current_max_hp + ' Maxhpever: ' + boss_options.totally_max_hp);
    var damageTaken = 0;
	var now = (new Date().getTime()) / 1000;
	if (boss_options.last_heal === undefined)
		boss_options.last_heal = now - Math.floor(Math.random() * 40);
	var healDiff = now - boss_options.last_heal;
	var useHealing = (healDiff >= 120) ? 1 : 0;
	gServer.ReportBossDamage(damageDone, damageTaken, useHealing, success, error);
}

// Update time remaining, and wait for the round to complete.
var INJECT_wait_for_end = function() {
	var now = new Date().getTime();
	time_passed_ms = now - current_game_start;
	var time_remaining_ms = (resend_frequency*1000) - time_passed_ms;
	var time_remaining = Math.round(time_remaining_ms/1000);

	// Update GUI
	gui.updateTask("Waiting " + Math.max(time_remaining, 0) + "s for round to end", false);
	gui.updateStatus(true);
	if (target_zone != -1)
		gui.updateEstimatedTime(calculateTimeToNextLevel());

	gui.progressbar.SetValue(time_passed_ms/(resend_frequency*1000));

	// Wait
	var wait_time = update_length*1000;
	var callback;

	// use absolute timestamps to calculate if the game is over, since setTimeout timings are not always reliable
	if(time_remaining_ms <= 0) {
		callback = function() { INJECT_end_round(); };
	}
	else {
		callback = function() { INJECT_wait_for_end(); };
	}

	// Set the timeout
	clearTimeout(current_timeout);
	current_timeout = setTimeout(callback, wait_time);
}

// Send the call to end a round, and restart if needed.
var INJECT_end_round = function(attempt_no) {
	if(attempt_no === undefined)
		attempt_no = 0;

	// Grab the max score we're allowed to send
	var score = get_max_score();

	// Update gui
	gui.updateTask("Ending Round");

	// Post our "Yay we beat the level" call
	$J.ajax({
		async: false,
		type: "POST",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/ReportScore/v0001/",
		data: { access_token: access_token, score: score, language: language },
		tryCount : 0,
		retryLimit : max_retry,
		success: function(data) {
			if( $J.isEmptyObject(data.response) ) {
				// Check if the zone is completed
				INJECT_update_grid(false); // Error handling set to false to avoid too much parallel calls with the setTimeout below
				if(window.gGame.m_State.m_Grid.m_Tiles[target_zone].Info.captured || attempt_no >= max_retry) {
					if (auto_switch_planet.active == true)
						CheckSwitchBetterPlanet();
					else
						SwitchNextZone();
				}
				else {
					console.log("Error getting zone response (on end):",data);
					gui.updateTask("Waiting 5s and re-sending score (Attempt #" + (attempt_no + 1) + ").");
					clearTimeout(current_timeout);
					current_timeout = setTimeout(function() { INJECT_end_round(attempt_no+1); }, 5000);
				}
			}
			else {
				console.log("Successfully finished the round and got expected data back:");
				console.log("Level: ", data.response.new_level, "\nEXP: ", data.response.new_score);
				console.log(data);

				// Update the player info
				INJECT_update_player_info();

				// Update GUI
				gui.updateLevel(data.response.new_level);
				if (gPlayerInfo.level == 25) {
					gui.updateExp(data.response.new_score + " / Infinite");
				} else {
					gui.updateExp(data.response.new_score + " / " + data.response.next_level_score);
				}
				gui.updateEstimatedTime(calculateTimeToNextLevel());
				gui.updateZone("None");

				// Restart the round if we have that variable set
				if(loop_rounds) {
					current_game_id = undefined;
					SwitchNextZone();
				}
			}
		},
		error: function (xhr, ajaxOptions, thrownError) {
			var messagesArray = ["end the round", "ending round"];
			var ajaxParams = {
				xhr: xhr,
				ajaxOptions: ajaxOptions,
				thrownError: thrownError
			};
			ajaxErrorHandling(this, ajaxParams, messagesArray);
		}
	});
}

// Leave an existing game
var INJECT_leave_round = function() {
	if(current_game_id === undefined)
		return;

	console.log("Leaving game: " + current_game_id);

	// Cancel timeouts
	clearTimeout(current_timeout);

	// POST to the endpoint
	$J.ajax({
		async: false,
		type: "POST",
		url: "https://community.steam-api.com/IMiniGameService/LeaveGame/v0001/",
		data: { access_token: access_token, gameid: current_game_id },
		tryCount : 0,
		retryLimit : max_retry,
		success: function(data) {},
		error: function (xhr, ajaxOptions, thrownError) {
			var messagesArray = ["leave the round", "leaving round"];
			var ajaxParams = {
				xhr: xhr,
				ajaxOptions: ajaxOptions,
				thrownError: thrownError
			};
			ajaxErrorHandling(this, ajaxParams, messagesArray);
		}
	});

	// Clear the current game ID var
	current_game_id = undefined;

	// Update the GUI
	gui.updateTask("Left Zone #" + target_zone);
	gui.updateStatus(false);

	target_zone = -1;
}

// returns 0 for easy, 1 for medium, 2 for hard
var INJECT_get_difficulty = function(zone_id) {
	return window.gGame.m_State.m_PlanetData.zones[zone_id].difficulty;
}

// Updates the player info
// Currently only used in INJECT_end_round. This was meant to hopefully update the UI.
var INJECT_update_player_info = function() {
	gServer.GetPlayerInfo(
		function( results ) {
			gPlayerInfo = results.response;
		},
		function(){}
	);
}

// Update the zones of the grid (map) on the current planet
var INJECT_update_grid = function(error_handling) {
	if(current_planet_id === undefined)
		return;
	if (error_handling === undefined)
		error_handling = true;

	// Skip update if a previous successful one happened in the last 8s
	if (last_update_grid !== undefined) {
		var last_update_diff = new Date().getTime() - last_update_grid;
		if ((last_update_diff / 1000) < 8)
			return;
	}

	gui.updateTask('Updating grid', true);

	// GET to the endpoint
	$J.ajax({
		async: false,
		type: "GET",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/GetPlanet/v0001/",
		data: { id: current_planet_id },
		tryCount : 0,
		retryLimit : max_retry,
		success: function(data) {
			window.gGame.m_State.m_PlanetData = data.response.planets[0];
			window.gGame.m_State.m_PlanetData.zones.forEach( function ( zone ) {
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.progress = zone.capture_progress;
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.captured = zone.captured;
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.difficulty = zone.difficulty;
				window.gGame.m_State.m_Grid.m_Tiles[zone.zone_position].Info.boss = zone.boss_active;
			});
			last_update_grid = new Date().getTime();
			console.log("Successfully updated map data on planet: " + current_planet_id);
		},
		error: function (xhr, ajaxOptions, thrownError) {
			if (error_handling == true) {
				var messagesArray = ["update the grid", "updating the grid"];
				var ajaxParams = {
					xhr: xhr,
					ajaxOptions: ajaxOptions,
					thrownError: thrownError
				};
				ajaxErrorHandling(this, ajaxParams, messagesArray);
			}
		}
	});
}

// Defaults to max score of current zone & full round duration if no params are given
function get_max_score(zone, round_duration) {
	// defaults
	if(zone === undefined)
		zone = target_zone;
	if(round_duration === undefined)
		round_duration = real_round_length;

	var difficulty = INJECT_get_difficulty(zone);
	var score = 5 * round_duration * Math.pow(2, (difficulty-1));

	return score;
}

// Get the best zone available
function GetBestZone() {
	var bestZone, highestDifficulty = -1, maxProgress = -1;

	gui.updateTask('Getting best zone');

	for (var idx = 0; idx < window.gGame.m_State.m_Grid.m_Tiles.length; idx++) {
		var zone = window.gGame.m_State.m_Grid.m_Tiles[idx].Info;
		if (!zone.captured && zone.progress > 0) {
			if (zone.boss) {
				//console.log("Zone " + idx + " with boss. Switching to it.");
				return [idx, zone.boss];
			}

			if(zone.difficulty >= highestDifficulty && zone.progress > maxProgress) {
				highestDifficulty = zone.difficulty;
				maxProgress = zone.progress;
				bestZone = [idx, zone.boss];
			}
			else continue;
		}
	}

    if(bestZone === undefined)
		console.log("Best zone wasn't found. Or you freezed at planet selection");
    else
        console.log("Best zone is " + bestZone);

	/* if(bestZone !== undefined) {
		//console.log(`${window.gGame.m_State.m_PlanetData.state.name} - Zone ${bestZone[0]} Progress: ${window.gGame.m_State.m_Grid.m_Tiles[bestZone[0]].Info.progress} Difficulty: ${window.gGame.m_State.m_Grid.m_Tiles[bestZone[0]].Info.difficulty}`);
	}*/
    return bestZone
}

// Get the best planet available
function GetBestPlanet() {
	var bestPlanetId = undefined;
	var activePlanetsScore = [];
	var planetsMaxDifficulty = [];
	var maxScore = 0;
	var numberErrors = 0;
	var bossSpawned = false;

	gui.updateStatus('Getting best planet');

	// GET to the endpoint
	$J.ajax({
		async: false,
		type: "GET",
		url: "https://community.steam-api.com/ITerritoryControlMinigameService/GetPlanets/v0001/",
		tryCount : 0,
		retryLimit : max_retry,
		success: function(data) {
			data.response.planets.forEach( function(planet) {
				if (planet.state.active == true && planet.state.captured == false)
					activePlanetsScore[planet.id] = 0;
					planetsMaxDifficulty[planet.id] = 0;
			});
		},
		error: function (xhr, ajaxOptions, thrownError) {
			var messagesArray = ["get active planets", "getting active planets"];
			var ajaxParams = {
				xhr: xhr,
				ajaxOptions: ajaxOptions,
				thrownError: thrownError
			};
			ajaxErrorHandling(this, ajaxParams, messagesArray);
		}
	});

	// GET the score of each active planet
	Object.keys(activePlanetsScore).forEach ( function (planet_id) {
		// GET to the endpoint
		$J.ajax({
			async: false,
			type: "GET",
			url: "https://community.steam-api.com/ITerritoryControlMinigameService/GetPlanet/v0001/",
			data: { id: planet_id },
			success: function(data) {
				data.response.planets[0].zones.forEach( function ( zone ) {
					if (zone.difficulty >= 1 && zone.difficulty <= 7 && zone.captured == false) {
						var zoneProgress = (zone.capture_progress === undefined) ? 0 : zone.capture_progress;
						var zoneScore = Math.ceil(Math.pow(10, (zone.difficulty - 1) * 2) * (1 - zoneProgress)) + ((zone.boss_active) ? 10000000000 : 0);
						activePlanetsScore[planet_id] += isNaN(zoneScore) ? 0 : zoneScore;
						if (zone.boss_active == true)
							bossSpawned = true;
						if (zone.difficulty > planetsMaxDifficulty[planet_id])
							planetsMaxDifficulty[planet_id] = zone.difficulty;
					}
				});
			},
			error: function() {
				numberErrors++;
			}
		});
		if (activePlanetsScore[planet_id] > maxScore) {
			maxScore = activePlanetsScore[planet_id];
			bestPlanetId = planet_id;
		}
	});
	console.log(activePlanetsScore);

	// Check if the maximum difficulty available on the best planet is the same as the current one and no boss spawned
	// If yes, no need to move. Except if max difficulty = 1 and score <= 20, we'll rush it for a new planet
	if ((current_planet_id in activePlanetsScore) && planetsMaxDifficulty[bestPlanetId] <= auto_switch_planet.current_difficulty && bossSpawned == false) {
		var lowScorePlanet = activePlanetsScore.findIndex(function(score) { return score <= 20; });
		if (planetsMaxDifficulty[bestPlanetId] == 1 && lowScorePlanet !== -1) {
			return lowScorePlanet;
		} else {
			return current_planet_id;
		}
	}

	// Prevent a planet switch if :
	// (there were >= 2 errors while fetching planets OR if there's an error while fetching the current planet score)
	// AND the max difficulty available on best planet found is <= current difficulty
	if ((numberErrors >= 2 || ((current_planet_id in activePlanetsScore) && activePlanetsScore[current_planet_id] == 0)) && planetsMaxDifficulty[bestPlanetId] <= auto_switch_planet.current_difficulty && bossSpawned == false)
		return null;

	return bestPlanetId;
}

// Switch to the next zone when one is completed
function SwitchNextZone(attempt_no, planet_call) {
	if(attempt_no === undefined)
		attempt_no = 0;
	if (planet_call === undefined)
		planet_call = false;

	INJECT_update_grid();
	var currentBestZone = GetBestZone();
	var next_zone = currentBestZone[0];

	if (next_zone !== undefined) {
		if (next_zone != target_zone) {
			console.log("Found new best zone: " + next_zone);
			current_game_is_boss = currentBestZone[1];
			INJECT_start_round(next_zone, access_token, attempt_no, current_game_is_boss);
		} else {
			console.log("Current zone #" + target_zone + " is already the best. No need to switch.");
			current_game_is_boss = currentBestZone[1];
			INJECT_start_round(target_zone, access_token, attempt_no, current_game_is_boss);
		}
	} else {
		if (auto_switch_planet.active == true) {
			console.log("There are no more zones, the planet must be completed. Searching a new one.");
			CheckSwitchBetterPlanet();
		} else {
			INJECT_leave_round();
			INJECT_update_grid();
			console.log("There are no more zones, the planet must be completed. You'll need to choose another planet!");
			target_zone = -1;
			INJECT_leave_planet();
		}
	}
}

// Check & switch for a potentially better planet, start to the best available zone
function CheckSwitchBetterPlanet(difficulty_call) {
	if (difficulty_call === undefined)
		difficulty_call = false;

	var now = new Date().getTime();
	var lastGameStart = (current_game_start === undefined) ? now : current_game_start;
	var timeDiff = (now - lastGameStart) / 1000;

	var best_planet = GetBestPlanet();

	if (best_planet !== undefined && best_planet !== null && best_planet != current_planet_id) {
		console.log("Planet #" + best_planet + " has higher XP potential. Switching to it. Bye planet #" + current_planet_id);
		INJECT_switch_planet(best_planet, function() {
			SwitchNextZone(0, difficulty_call);
		});
	} else if (best_planet == current_planet_id) {
		if ((timeDiff >= 8 && difficulty_call == true) || difficulty_call == false)
			SwitchNextZone(0, difficulty_call);
	} else if (best_planet === null) {
		console.log("Too many errors while searching a better planet. Let's continue on the current zone.");
		if ((timeDiff >= 8 && difficulty_call == true) || difficulty_call == false)
			INJECT_start_round(target_zone, access_token, 0, current_game_is_boss);
	} else {
		console.log("There's no planet better than the current one.");
	}
	// Hide the game. Bug reason.
	//$J('#animationsCheckbox').prop('checked', !animations_enabled);
	/*if($J('#animationsCheckbox').prop('checked'))
	{
		INJECT_toggle_animations(!this.checked);
	}*/
}

var INJECT_switch_planet = function(planet_id, callback) {
	// ONLY usable from battle selection, if at planet selection, run join instead
	if(gGame.m_State instanceof CPlanetSelectionState)
		join_planet_helper(planet_id);
	if(!(gGame.m_State instanceof CBattleSelectionState))
		return;

	gui.updateTask("Attempting to move to Planet #" + planet_id);

	// Leave our current round if we haven't.
	INJECT_leave_round();

	// Leave the planet
	INJECT_leave_planet(function() {
		// Join Planet
		join_planet_helper(planet_id);
	});

	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState) {
			clearTimeout(current_timeout);
			current_timeout = setTimeout(function() { wait_for_state_load(); }, 50);
		}
		else
			callback();
	}

	function join_planet_helper(planet_id) {
		// Make sure the planet_id is valid (or we'll error out)
		var valid_planets = gGame.m_State.m_rgPlanets;
		var found = false;
		for(var i=0; i<valid_planets.length; i++)
			if (valid_planets[i].id == planet_id)
					found = true;
		if(!found) {
			gui.updateTask("Attempted to switch to an invalid planet. Please choose a new one.");
			gui.updateStatus(false);
			return;
		}

		INJECT_join_planet(planet_id,
			function ( response ) {
				gGame.ChangeState( new CBattleSelectionState( planet_id ) );
				wait_for_state_load();
			},
			function ( response ) {
                console.log('%c Join Planet Error', '%c Failed to join planet. Please reload your game or try again shortly.', 'color: red;', 'color: blue;' );
			});
        //ShowAlertDialog( 'Join Planet Error', 'Failed to join planet. Please reload your game or try again shortly.' );
	}
}

// Leave the planet
var INJECT_leave_planet = function(callback) {
	if(typeof callback !== 'function')
		callback = function() {};

	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CBattleSelectionState) {
			clearTimeout(current_timeout);
			current_timeout = setTimeout(function() { wait_for_state_load(); }, 50);
		}
		else {
			// Clear the current planet ID var
			current_planet_id = undefined;

			INJECT_init();

			// Restore old animation state
			INJECT_toggle_animations(anim_state);

			callback();
		}
	}

	// Cancel timeouts
	clearTimeout(current_timeout);

	// Leave our current round if we haven't.
	INJECT_leave_round();

	// Temporarily enable animations
	var anim_state = animations_enabled;
	INJECT_toggle_animations(true);

	// (Modified) Default Code
	gAudioManager.PlaySound( 'ui_select_backwards' );
	gServer.LeaveGameInstance(
		gGame.m_State.m_PlanetData.id,
		function() {
			gGame.ChangeState( new CPlanetSelectionState() );
			// Wait for the new state to load, then hook in
			wait_for_state_load();
		}
	);
}

var INJECT_join_planet = function(planet_id, success_callback, error_callback) {

	if(typeof success_callback !== 'function')
		success_callback = function() {};
	if(typeof error_callback !== 'function')
		error_callback = function() {};

	function wait_for_state_load() {
		if(gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState) {
			clearTimeout(current_timeout);
			current_timeout = setTimeout(function() { wait_for_state_load(); }, 50);
		}
		else {
			current_planet_id = planet_id;
			INJECT_init();

			// Restore old animation state
			INJECT_toggle_animations(anim_state);
		}
	}

	// Modified Default code
	var rgParams = {
		id: planet_id,
		access_token: access_token
	};

	// Temporarily enable animations
	var anim_state = animations_enabled;
	INJECT_toggle_animations(true);

	$J.ajax({
		async: false,
		url: window.gServer.m_WebAPI.BuildURL( 'ITerritoryControlMinigameService', 'JoinPlanet', true ),
		method: 'POST',
		data: rgParams
	}).success( function( results, textStatus, request ) {
		if ( request.getResponseHeader( 'x-eresult' ) == 1 ) {
			success_callback( results );
			// Wait for the new state to load, then hook in
			wait_for_state_load();
		}
		else {
			console.log(results, textStatus, request);
			error_callback();
		}
	}).fail( error_callback );
}

var INJECT_init_battle_selection = function() {
	// Update the GUI
	gui.updateStatus(true);
	gui.updateTask("Initializing Battle Selection Menu.");

	// Check the game state for hangups occasionally
	if (check_game_state !== undefined)
		clearInterval(check_game_state);
	check_game_state = setInterval(checkUnlockGameState, 60000);

	// Auto join best zone at first
	if (auto_first_join == true) {
		firstJoin();
		function firstJoin() {
			// Wait for state & access_token
			if(access_token === undefined || gGame === undefined || gGame.m_IsStateLoading || gGame.m_State instanceof CPlanetSelectionState) {
				clearTimeout(current_timeout);
				current_timeout = setTimeout(function() { firstJoin(); }, 100);
				console.log("waiting");
				return;
			}

			current_planet_id = window.gGame.m_State.m_PlanetData.id;

			if(access_token === undefined)
				INJECT_get_access_token();

			var first_zone;
			if(target_zone === -1) {
				SwitchNextZone();
			} else {
				first_zone = target_zone;
				current_game_is_boss = window.gGame.m_State.m_Grid.m_Tiles[first_zone].Info.boss;
				INJECT_start_round(first_zone, access_token, 0, current_game_is_boss);
			}
		}
	}

	// Overwrite join function so clicking on a grid square will run our code instead
	gServer.JoinZone = function (zone_id, callback, error_callback) {
		current_planet_id = window.gGame.m_State.m_PlanetData.id;
		current_game_is_boss = window.gGame.m_State.m_Grid.m_Tiles[zone_id].Info.boss;
		INJECT_start_round(zone_id, access_token, 0, current_game_is_boss);
	}

	// Hook the Grid click function
	var grid_click_default = gGame.m_State.m_Grid.click;
	gGame.m_State.m_Grid.click = function(tileX, tileY) {
		// Get the selected zone ID
		var zoneIdx = _GetTileIdx( tileX, tileY );

		// Return if it's the current zone (Don't want clicking on same zone to leave/rejoin)
		if(target_zone === zoneIdx)
			return;

		// Return if it's a completed zone
		if(window.gGame.m_State.m_Grid.m_Tiles[zoneIdx].Info.captured) {
			console.log("Manually selected zone already captured. Returning.");
			return;
		}

		// Update the GUI
		gui.updateTask("Attempting manual switch to Zone #" + zoneIdx);
		gui.progressbar.parent.removeChild(gui.progressbar);

		// Leave existing round
		INJECT_leave_round();

		// Join new round
		current_game_is_boss = window.gGame.m_State.m_Grid.m_Tiles[zoneIdx].Info.boss;
		INJECT_start_round(zoneIdx, access_token, 0, current_game_is_boss);
	}

	// Hook the Leave Planet Button
	gGame.m_State.m_LeaveButton.click = function(btn) {
		INJECT_leave_planet();
	};
}

var INJECT_init_planet_selection = function() {
	gui.updateStatus(true);
	gui.updateTask("Initializing Planet Selection Menu.");

	// Hook the Join Planet Function
	gServer.JoinPlanet = function(planet_id, success_callback, error_callback) {
		INJECT_join_planet(planet_id, success_callback, error_callback);
	}
    console.log('Joke ' + gServer.JoinPlanet);

	// Update GUI
	gui.updateStatus(false);
	gui.updateTask("At Planet Selection");
	gui.updateZone("None");
};

var INJECT_init = function() {
	// Set Account ID
	account_id = gAccountID;

	if (gGame.m_State instanceof CBattleSelectionState)
		INJECT_init_battle_selection();
	else if (gGame.m_State instanceof CPlanetSelectionState) {
        var funcResult = INJECT_init_planet_selection();
        if (funcResult === undefined)
            CheckSwitchBetterPlanet();
	}
};

var INJECT_toggle_animations = function(enabled) {

	if(enabled)
	{
		// Show canvas
		$J("canvas").show();
		// Enable animations
		gApp.ticker.start();
	}
	else
	{
		// Hide canvas
		$J("canvas").hide();
		// Disable animations
		gApp.ticker.stop();
	}
	animations_enabled=enabled;
};

// Run initialization code on load
$J(document).ready(function() {
	// Auto-grab the access token
	INJECT_get_access_token();

	// Call our global init function
	initGUI();
})
