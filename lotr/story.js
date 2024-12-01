// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'Try again?';
squiffy.story.id = 'a0c41eed7b';
squiffy.story.sections = {
	'Try again?': {
		'clear': true,
		'text': "<p>Welcome to &quot;The Lord of the Rings: All Paths Lead to Doom&quot;, a Choose-Your-Own-Text-Adventure story. Please choose from the following:</p>\n<ol>\n<li><a class=\"squiffy-link link-section\" data-section=\"Begin a New Adventure\" role=\"link\" tabindex=\"0\">Begin a New Adventure</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Read the Instructions\" role=\"link\" tabindex=\"0\">Read the Instructions</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Review a Middle-Earth Primer\" role=\"link\" tabindex=\"0\">Review a Middle-Earth Primer</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"View the Completionist's Guide\" role=\"link\" tabindex=\"0\">View the Completionist&#39;s Guide</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Learn About the Game\" role=\"link\" tabindex=\"0\">Learn About the Game</a></li>\n<li><a class=\"squiffy-link link-section\" data-section=\"Start New Game Plus\" role=\"link\" tabindex=\"0\">Start New Game Plus</a></li>\n</ol>\n<p><strong>This game saves your progress automatically. Please turn on your browser&#39;s cookies before playing.</strong></p>",
		'attributes': ["jam = 0","gandalfAngry = 0","gandalfLockedOut = 0","gandalfRefusedQuest = 0","gandalfDragsYouFromBree = 0","gandalfGoadedOnWeathertop = 0","gandalfDraggedYouToCouncil = 0","gandalfOfferedRingToBoromir = 0","gandalfDissedOnMountain = 0","gandalfComplainedInMoria = 0","gandalfPushedBucket = 0","hasButterknife = 0","precious = 0","learnedTomsSong = 0","triedWearRing = 0","gaveFakeName = 0","hobbitGroup = 3","defeatedChief = 0","witchKingDanceOff = 0","ridersDefeated = 0","merryPippinCome = 0","samDead = 0","samDrowned = 0","merryStillAlive = 0","merryDead = 0","merryKilledOnWeathertop = 0","pippinDead = 0","pippinSurvived = 0","pippinKilledByWitchKing = 0","pippinTriesToTakeTheRing = 0","pippinKilledBilbo = 0","fellowship = 0","gandalfDead = 0","boromirDead = 0","faramirDead = 0","bilboDead = 0","gollumDead = 0","gimliDead = 0","legolasDead = 0","witchKingDead = 0","sauronDead = 0","elrondDead = 0","theodenDead = 0","eaglesComing = 0","samJoins = 0","merryJoins = 0","arwenJoins = 0","beornJoins = 0","pathCaradhas = 0","spellAgainstCold = 0","spellAgainstSaruman = 0","gandalfMakesAvalanche = 0","merryPippinFellFromMountain = 0","stabbedBySpear = 0","boromirRemembers = 0","gandalfRemembers = 0","galadrielHigh = 0","galadrielFailed = 0","frodoAlone = 0","samSaved = 0","hasMythrilVest = 0","hasSwordSting = 0","hasSwordAragorn = 0","hasShampoo=0","hasBrightMail = 0","hasSeed = 0","hasTShirt = 0","hasDVD = 0","boromirTriedToTakeRing = 0","boromirForgiven = 0","tomAnnoyed = 0","gandalfWhite = 0","gandalfInRohan = 0","gandalfInMordor = 0","boromirInRohan = 0","boromirInMordor = 0","merryPippinInRohan = 0","merryPippinInMordor = 0","hadDinnerInMordor = 0","possessedBySauron = 0","gollumKilledByYou = 0","defeatedMineCartOrcs = 0","talionSkill = 1","butterknifeKing = 0","nakedHobbits = 0","teamName = NOT ENTERED","gollumKnows = 0","sauronKnows = 0","entsAngry = 0","entsWillFight = 0","rohanWillFight = 0","ghostsWillFight = 0","karaokeWin = 0","soldierReaction1 = NOT ENTERED","soldierReaction2 = NOT ENTERED","soldierReaction3 = NOT ENTERED","proofTimeTravel = 0","glorfyHit = 0","merryPippinOutsideGate = 0","pippinOutsideGate = 0","elvesFullPower = 0","elvesHalfPower = 0","fellowshipWeak = 0","hasMirrorArmour = 0","hasSilmaril = 0","defeatedSaruman = 0","failedDream = 0","boromirWonDream = 0","boromirRedeemed = 0","defeatedMorgoth = 0","boromirSacrificed = 0","FellowshipKilledInMordor = 0","FellowshipLeft = 0","pokerHand = 0","hasFishJerky = 0","merryPippinExtreme = 0","voteNay = 8","eowynLikesYou = 0","hasGhostArmy = 0","frodoHardened = 0","metGandalfInFangorn = 0","learnedEntish = 0","lostMinasTirith = 0","gandalfDestroyed = 1","choiceTea = 0","choiceQuest = 0","choiceMP = 0","choiceFakeName = 0","choiceWeathertop = 0","choiceCouncil = 0","choicePath = 0","samTakenAway = 0","boromirThrownIn = 0","notRested = 0"],
		'passages': {
		},
	},
	'Read the Instructions': {
		'clear': true,
		'text': "<p>In this story, you play as Frodo Baggins from J.R.R. Tolkien&#39;s &quot;Lord of the Rings&quot; and relive his journey to Mt. Doom. You can follow the original story, or choose alternate paths that change his story in surprising new ways. Be sure to replay it multiple times to experience the many different story branches and endings.</p>\n<p>A few key things to keep in mind:</p>\n<ol>\n<li><p>You can&#39;t die during your journey or hit a dead end. Every choice you make, no matter how dangerous, moves the story forward. <U>All paths lead to Doom.</U></p>\n</li>\n<li><p>Even though you can&#39;t die, <U>your choices will have consequences</U> on the people around you.</p>\n</li>\n<li><p>You&#39;ll typically be given two choices at any time. If a third option appears, it may contain a hidden &quot;story switch&quot;. This could be a special item, skill, or action that lets you unlock a secret path later.</p>\n</li>\n<li><p>Your browser saves your game as you go, but this game engine does not allow multiple saves. Restarting the game returns you to the main menu and erases your journey.</p>\n</li>\n</ol>\n<p><a class=\"squiffy-link link-section\" data-section=\"Go back\" role=\"link\" tabindex=\"0\">Go back</a></p>",
		'passages': {
		},
	},
	'Review a Middle-Earth Primer': {
		'clear': true,
		'text': "<p>If this bizarre text adventure is somehow your introduction to Middle-Earth, here&#39;s some background on what you&#39;re getting yourself into.</p>\n<p>&quot;The Lord of the Rings&quot; was a best-selling fantasy book series written by J.R.R. Tolkien between 1937 and 1949. It takes place in the fictional land of Middle-Earth, a world populated by races like humans, elves, dwarves, and hobbits.</p>\n<p>The story follows Frodo Baggins, nephew to Bilbo Baggins who was the hero in Tolkien&#39;s previous novel, &quot;The Hobbit&quot;. In it, Frodo travels with a Fellowship of warriors on a quest to destroy a dangerous magical Ring. The story was adapted into an award-winning film series by Peter Jackson in 2001-2003.</p>\n<p>This game contains many, many spoilers and assumes you&#39;ve already read the books or watched the movies. If not, it&#39;s recommended to do so. That way, you can better enjoy all the new choices you make along Frodo&#39;s journey.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Go back\" role=\"link\" tabindex=\"0\">Go back</a></p>",
		'passages': {
		},
	},
	'View the Completionist\'s Guide': {
		'clear': true,
		'text': "<p>There are many hidden paths in Frodo&#39;s Journey and even more hidden outcomes. To find them all, you&#39;ll need to replay the story and explore where different choices will lead you. If you copy the following lists to your notepad, you can use them to keep track of the stories and side-quests you&#39;ve found. </p>\n<p>However, remember that some stories are harder to find than others. While you can use &quot;New Game Plus&quot; to skip ahead and find easier story paths, you can only unlock the most secret stories by playing from the beginning.</p>\n<p>There are three levels of story difficulty: <a class=\"squiffy-link link-passage\" data-passage=\"Easy\" role=\"link\" tabindex=\"0\">Easy</a>, <a class=\"squiffy-link link-passage\" data-passage=\"Normal\" role=\"link\" tabindex=\"0\">Normal</a>, and <a class=\"squiffy-link link-passage\" data-passage=\"Hard\" role=\"link\" tabindex=\"0\">Hard</a>. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Go back\" role=\"link\" tabindex=\"0\">Go back</a> to the main menu, otherwise.</p>",
		'passages': {
			'Easy': {
				'text': "<B>EASY MODE</B> \n\n<p>These stories follow the most basic choices. You can easily get onto their paths by using &quot;New Game Plus&quot; to skip half the story and start at Amon Hen.</p>\n<p><LI>Did you and Sam follow Tolkien’s path into Mordor?</p>\n<p><LI>Did you manage to ditch Gollum and claim the Ring for yourself?</p>\n<p><LI>Did you get captured by orcs and taken to Rohan?</p>\n<p><LI>Did you destroy the Ring all by yourself, without any help?</p>\n<p><LI>Did you destroy the Ring mostly by yourself, after ditching Sam?</p>\n<p><LI>Did you let Faramir reclaim his family’s honour at Mt. Doom?</p>\n<p><LI>Did you die at Mt. Doom in the arms of your loved ones?</p>\n<p><LI>Did you escape the Tower of Barad-dûr and resist Sauron’s thrall?</p>\n<p><LI>Did you cross the Sea of Nurnen and beat Gimli at poker?</p>\n<p><LI>Did you escape the Door of Night with minimal casualties?</p>\n<p><LI>Did you get Ring-Wraith powers and go combo-crazy on Mordor?</p>\n<p><LI>Did you turn into a bear and steal Ranger Smith’s pic-a-nic basket?</p>\n<p><LI>Did you take a giant spider to Denny’s for a limited-time Hobbit Breakfast Slam?</p>",
			},
			'Normal': {
				'text': "<B>NORMAL MODE</B>\n\n<p>These stories are trickier to find and require you to make a few unorthodox choices along the way - which you&#39;ll probably try to do anyway. You can use &quot;New Game Plus&quot; to skip ahead to Bree or Rivendell and try these paths from there.</p>\n<p><LI>Did you fight the Battle of Mt. Doom all by yourself?</p>\n<p><LI>Did you rescue Sam from Cirith Ungol and get that long-awaited kiss?</p>\n<p><LI>Did you infiltrate the Eagle’s Eyrie with a daring Ocean’s Eleven heist?</p>\n<p><LI>Did you get possessed and require Sam to beat the Sauron out of you?</p>\n<p><LI>Did you and the Fellowship have a wacky eagle adventure?</p>\n<p><LI>Did you help Boromir find his redemption at Mt. Doom?</p>\n<p><LI>Did you escape the Door of Night with the whole Fellowship intact?</p>\n<p><LI>Did you become King of Rivendell somehow?</p>\n<p><LI>Did you help Eowyn become Queen of Rohan?</p>",
			},
			'Hard': {
				'text': "<B>HARD MODE</B>\n\n<p>You&#39;ll need to ignore &quot;New Game Plus&quot; and start from the beginning to find these super-secret stories. Not only do you have to make unusual choices, but you sometimes need to trigger special story switches along the way just to open the paths. These stories are for the most hardcore adventurers.</p>\n<p><LI>Did you drive Gandalf completely insane with rage?</p>\n<p><LI>Did you find the lost sword shard and become King of Gondor?</p>\n<p><LI>Did you escape the Door of Night with only Aragorn?</p>\n<p><LI>Did you recruit the ghost of Smaug to fight the ghost of Morgoth?</p>\n<p><LI>Did you find your real father and make him proud?</p>\n<p><LI>Did you and Tom Bombadil become the Kings of Karaoke?</p>\n<p><LI>Did you bring about a zombie apocalypse?</p>\n<p><LI>Did you get the Lion King ending?</p>\n<p><LI>Did you beat the Battle of Minas Tirith with all allies?</p>\n<p><LI>Did you lose the Battle of Minas Tirith with zero allies?</p>\n<p><LI>Did you lose all your loved ones and become the saddest hobbit ever?</p>\n<p><LI>Did you befriend Sauron and become the new King of Mordor?</p>\n<p><LI>Did you break the fourth wall so hard, you destroyed the time/space continuum?</p>",
			},
		},
	},
	'Learn About the Game': {
		'clear': true,
		'text': "<p>Hi! I&#39;m Chris Ushko, the author of this game. I made it on &quot;Squiffy&quot; shortly after my daughter was born. I needed a creative project to maintain my sanity between diaper changes, and writing a text adventure on my phone seemed like a good idea at the time.</p>\n<p>I chose &quot;Lord of the Rings&quot; because obviously I&#39;m a fan of the books and films, and was always fascinated with the possibilities the stories could have followed. I wanted to explore how far all three novels could unravel if the characters made different choices. &quot;What if Frodo didn&#39;t go to Moria? What if they just kept crossing the mountains? What would happen if they killed Gollum? Why can&#39;t they just fly eagles into Mordor?&quot; And so on.</p>\n<p>There&#39;s many secret paths to follow. Some paths are quite serious, others dive into extended lore, and other paths can get very silly, very quickly. You can use the &quot;Completionist&#39;s Guide&quot; to try and find them all if you dare.</p>\n<p>And that&#39;s it! I hope you enjoy the game as much as I enjoyed writing it! Have fun with your adventures in Middle-Earth!</p>\n<p>(And if you&#39;re Tolkien&#39;s lawyers, just poke me and I&#39;ll take this down.)</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Go back\" role=\"link\" tabindex=\"0\">Go back</a></p>",
		'passages': {
		},
	},
	'Start New Game Plus': {
		'clear': true,
		'text': "<p>&quot;New Game Plus&quot; allows you to skip over large segments of story with just a few key choices. Be warned that using this shortcut will bypass many of the secret &quot;story switches&quot; and any minor choices will default to the safe ones. To unlock the game&#39;s secret endings, you must play from the beginning.</p>\n<p>Choose your starting point:</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Start from Bree\" role=\"link\" tabindex=\"0\">Start from Bree</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Start from Rivendell\" role=\"link\" tabindex=\"0\">Start from Rivendell</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Start from Amon Hen\" role=\"link\" tabindex=\"0\">Start from Amon Hen</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Go back\" role=\"link\" tabindex=\"0\">Go back</a></p>",
		'passages': {
		},
	},
	'Start from Bree': {
		'clear': true,
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextBree, choiceTea=1\" role=\"link\" tabindex=\"0\">choose tea</a> or <a class=\"squiffy-link link-section\" data-section=\"nextBree, choiceTea=0\" role=\"link\" tabindex=\"0\">choose toast</a>?</p>",
		'passages': {
		},
	},
	'nextBree': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextBree2, choiceQuest=1\" role=\"link\" tabindex=\"0\">accept Gandalf&#39;s quest</a> or <a class=\"squiffy-link link-section\" data-section=\"nextBree3, choiceQuest=0\" role=\"link\" tabindex=\"0\">refuse Gandalf&#39;s quest</a>?</p>",
		'passages': {
		},
	},
	'nextBree2': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextBree3, choiceMP=1\" role=\"link\" tabindex=\"0\">invite Merry and Pippin</a> or <a class=\"squiffy-link link-section\" data-section=\"nextBree3, choiceMP=0\" role=\"link\" tabindex=\"0\">send Merry and Pippin home</a>?</p>",
		'passages': {
		},
	},
	'nextBree3': {
		'text': "<p>Choices selected.\n{if choiceTea=0:{@jam=1}}\n{if choiceQuest=0:{@samDead=1}}\n{if choiceMP=1:{@merryPippinCome=1}}\n{if choiceMP=1:{@merryStillAlive=1}}</p>\n<p>{if choiceQuest=0:You have traveled alone from Hobbiton. Tom Bombadil joined you briefly, but you left his company.}{if choiceQuest=1:Sam has traveled with you from Hobbiton.} {if choiceMP=1:Merry and Pippin joined you on the way.} You successfully evade the Black Riders and make it to the town of Bree.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the inn.\" role=\"link\" tabindex=\"0\">Your adventure begins at the Prancing Pony inn.</a></p>",
		'passages': {
		},
	},
	'Start from Rivendell': {
		'clear': true,
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextRivendell, choiceTea=1\" role=\"link\" tabindex=\"0\">choose tea</a> or <a class=\"squiffy-link link-section\" data-section=\"nextRivendell, choiceTea=0\" role=\"link\" tabindex=\"0\">choose toast</a>?</p>",
		'passages': {
		},
	},
	'nextRivendell': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextRivendell2, choiceQuest=1\" role=\"link\" tabindex=\"0\">accept Gandalf&#39;s quest</a> or <a class=\"squiffy-link link-section\" data-section=\"nextRivendell3, choiceQuest=0\" role=\"link\" tabindex=\"0\">refuse Gandalf&#39;s quest</a>?</p>",
		'passages': {
		},
	},
	'nextRivendell2': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextRivendell3, choiceMP=1\" role=\"link\" tabindex=\"0\">invite Merry and Pippin</a> or <a class=\"squiffy-link link-section\" data-section=\"nextRivendell3, choiceMP=0\" role=\"link\" tabindex=\"0\">send Merry and Pippin home</a>?</p>",
		'passages': {
		},
	},
	'nextRivendell3': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextRivendell4, choiceFakeName=1\" role=\"link\" tabindex=\"0\">give out a fake name</a> at the inn or <a class=\"squiffy-link link-section\" data-section=\"nextRivendell4, choiceFakeName=0\" role=\"link\" tabindex=\"0\">tell them your real one</a>?</p>",
		'passages': {
		},
	},
	'nextRivendell4': {
		'text': "<p>{if choiceQuest=0:{@hobbitGroup=1}}\n{if choiceQuest=1:{if choiceMP=0:{@hobbitGroup=2}}}\n{if choiceQuest=1:{if choiceMP=1:{@hobbitGroup=3}}}</p>\n<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextRivendell5, choiceWeathertop=1\" role=\"link\" tabindex=\"0\">confront the Black Riders</a> on Weathertop or <a class=\"squiffy-link link-section\" data-section=\"nextRivendell5, choiceWeathertop=0\" role=\"link\" tabindex=\"0\">use the Ring to hide from them</a>?</p>",
		'passages': {
		},
	},
	'nextRivendell5': {
		'text': "<p>Choices selected.\n{if choiceTea=0:{@jam=1}}\n{if choiceQuest=0:{@samDead=1}}\n{if choiceMP=1:{@merryPippinCome=1}}\n{if choiceMP=1:{@merryStillAlive=1}}\n{if choiceFakeName=1:{@gaveFakeName=1}}\n{if choiceFakeName=0:{if choiceWeathertop=1:{if jam=0:{if hobbitGroup=3:{@merryDead=1}}}}}\n{if choiceFakeName=0:{if choiceWeathertop=1:{if jam=0:{if hobbitGroup=3:{@merryKilledOnWeathertop=1}}}}}</p>\n<p>{if choiceQuest=0:You have traveled alone from Hobbiton. Tom Bombadil joined you briefly, but you left his company.}{if choiceQuest=1:Sam has traveled with you from Hobbiton.} {if choiceMP=1:Merry and Pippin joined you on the way.} You successfully evade the Black Riders and make it to the town of Bree.</p>\n<p>While in Bree, {if jam=0:there was no sign of Gandalf, and you were met by his ranger friend, Strider, instead}{if jam=1:you met up with Gandalf, who introduced you to a ranger named Strider}. You set out towards Rivendell and made camp on Weathertop, where you were attacked by Black Riders. {if choiceWeathertop=0:You tried to hide from them, but were stabbed.}{if choiceWeathertop=1:A battle broke out{if choiceFakeName=0: and the Witch King arrived to capture you}} {if choiceFakeName=0:{if choiceWeathertop=1:{if jam=0:{if hobbitGroup=3:Merry was killed in the encounter}}}}. {if choiceWeathertop=1:{if jam=1:Gandalf drove them away.}}</p>\n<p>You survived your encounter and eventually made your way to Rivendell, where you rested. {if jam=0:Here, you met up with Gandalf again.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gandalf gets to the situation at hand.\" role=\"link\" tabindex=\"0\">Your adventure begins in Rivendell.</a></p>",
		'passages': {
		},
	},
	'Start from Amon Hen': {
		'clear': true,
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon, choiceTea=1\" role=\"link\" tabindex=\"0\">choose tea</a> or <a class=\"squiffy-link link-section\" data-section=\"nextAmon, choiceTea=0\" role=\"link\" tabindex=\"0\">choose toast</a>?</p>",
		'passages': {
		},
	},
	'nextAmon': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon2, choiceQuest=1\" role=\"link\" tabindex=\"0\">accept Gandalf&#39;s quest</a> or <a class=\"squiffy-link link-section\" data-section=\"nextAmon3, choiceQuest=0\" role=\"link\" tabindex=\"0\">refuse Gandalf&#39;s quest</a>?</p>",
		'passages': {
		},
	},
	'nextAmon2': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon3, choiceMP=1\" role=\"link\" tabindex=\"0\">invite Merry and Pippin</a> or <a class=\"squiffy-link link-section\" data-section=\"nextAmon3, choiceMP=0\" role=\"link\" tabindex=\"0\">send Merry and Pippin home</a>?</p>",
		'passages': {
		},
	},
	'nextAmon3': {
		'text': "<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon4, choiceFakeName=1\" role=\"link\" tabindex=\"0\">give out a fake name</a> at the inn or <a class=\"squiffy-link link-section\" data-section=\"nextAmon4, choiceFakeName=0\" role=\"link\" tabindex=\"0\">tell them your real one</a>?</p>",
		'passages': {
		},
	},
	'nextAmon4': {
		'text': "<p>{if choiceQuest=0:{@hobbitGroup=1}}\n{if choiceQuest=1:{if choiceMP=0:{@hobbitGroup=2}}}\n{if choiceQuest=1:{if choiceMP=1:{@hobbitGroup=3}}}</p>\n<p>{if choiceTea=0:{@jam=1}}\n{if choiceQuest=0:{@samDead=1}}\n{if choiceMP=1:{@merryPippinCome=1}}\n{if choiceMP=1:{@merryStillAlive=1}}\n{if choiceFakeName=1:{@gaveFakeName=1}}</p>\n<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon5, choiceWeathertop=1\" role=\"link\" tabindex=\"0\">confront the Black Riders</a> on Weathertop or <a class=\"squiffy-link link-section\" data-section=\"nextAmon5, choiceWeathertop=0\" role=\"link\" tabindex=\"0\">use the Ring to hide from them</a>?</p>",
		'passages': {
		},
	},
	'nextAmon5': {
		'text': "<p>{if choiceFakeName=0:{if choiceWeathertop=1:{if jam=0:{if hobbitGroup=3:{@merryDead=1}}}}}\n{if choiceFakeName=0:{if choiceWeathertop=1:{if jam=0:{if hobbitGroup=3:{@merryKilledOnWeathertop=1}}}}}</p>\n<p>{if merryDead=1:{if pippinDead=0:{@pippinTriesToTakeTheRing=1}}}\n{if hobbitGroup=1:{@fellowship=1}}\n{if hobbitGroup=2:{@fellowship=2}}\n{if hobbitGroup=3:{if merryDead=0:{@fellowship=3}}}\n{if hobbitGroup=3:{if merryDead=1:{@fellowship=2}}}\n{if hobbitGroup=3:{if merryDead=1:{@pippinDead=1}}}</p>\n<p>At the Council, did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon6, choiceCouncil=1\" role=\"link\" tabindex=\"0\">agree to take the Ring to Mordor</a> or <a class=\"squiffy-link link-section\" data-section=\"nextAmon6, choiceCouncil=0\" role=\"link\" tabindex=\"0\">refuse to at first</a>?</p>",
		'passages': {
		},
	},
	'nextAmon6': {
		'text': "<p>{if choiceCouncil=1:{@hasSwordSting=1}}\n{if choiceCouncil=1:{@hasMythrilVest=1}}\n{if choiceCouncil=0:{@bilboDead=1}}\n{if choiceCouncil=0:{if hobbitGroup=3:{if merryDead=1:{@pippinKillsBilbo=1}}}}\n{if fellowship=1:{@arwenJoins=1}}\n{if fellowship=1:{@beornJoins=1}}\n{if fellowship=2:{@arwenJoins=1}}</p>\n<p>Did you <a class=\"squiffy-link link-section\" data-section=\"nextAmon7, choicePath=0\" role=\"link\" tabindex=\"0\">cross the mountains of Caradhras</a> or <a class=\"squiffy-link link-section\" data-section=\"nextAmon7, choicePath = 1\" role=\"link\" tabindex=\"0\">enter the mines of Moria</a>?</p>",
		'passages': {
		},
	},
	'nextAmon7': {
		'text': "<p>{if choicePath=0:{if fellowship=3:{if jam=0:{@merryPippinFellFromMountain=1}}}}\n{if choicePath=0:{if fellowship=3:{if jam=0:{@merryDead=1}}}}\n{if choicePath=0:{if fellowship=3:{if jam=0:{@pippinDead=1}}}}\n{if choicePath=0:{if fellowship=3:{if jam=1:{@eaglesComing=1}}}}\n{if choicePath=0:{@galadrielHigh=1}}\n{if choicePath=1:{@gandalfDead=1}}\n{if choicePath=1:{@galadrielFailed=1}}\n{if choicePath=1:{if choiceCouncil=0:{@stabbedBySpear=1}}}\n{if choicePath=1:{if choiceCouncil=0:{@hasBrightMail=1}}}</p>\n<p>Choices selected.</p>\n<p>{if choiceQuest=0:You have traveled alone from Hobbiton. Tom Bombadil joined you briefly, but you left his company.}{if choiceQuest=1:Sam has traveled with you from Hobbiton.} {if choiceMP=1:Merry and Pippin joined you on the way.} You successfully evade the Black Riders and make it to the town of Bree.</p>\n<p>While in Bree, {if jam=0:there was no sign of Gandalf, and you were met by his ranger friend, Strider, instead}{if jam=1:you met up with Gandalf, who introduced you to a ranger named Strider}. You set out towards Rivendell and made camp on Weathertop, where you were attacked by Black Riders. {if choiceWeathertop=0:You tried to hide from them, but were stabbed.}{if choiceWeathertop=1:A battle broke out{if choiceFakeName=0: and the Witch King arrived to capture you.}} {if choiceFakeName=0:{if choiceWeathertop=1:{if jam=0:{if hobbitGroup=3:Merry was killed in the encounter.}}}} {if choiceWeathertop=1:{if jam=1:Gandalf drove them away.}}</p>\n<p>You survived your encounter and eventually made your way to Rivendell, where you rested. {if jam=0:Here, you met up with Gandalf again.} {if choiceCouncil=1:You accepted to escort the Ring to Mordor with a Fellowship of Nine.}{if choiceCouncil=0:You refused to carry the Ring any further and passed it back to your Uncle Bilbo. He died{if pippinKillsBilbo=1:, killed by Pippin,} before his adventure could begin, and the Ring returned to you.} You set out with Gandalf, Aragorn, Gimli, Legolas, {if fellowship&lt;3:Arwen, Glorfindel, }{if fellowship=1:Beorn, }{if fellowship&gt;1:Sam, }{if fellowship=3:Merry, Pippin, }and Boromir.</p>\n<p>{if choicePath=0:You crossed the mountains of Caradhras, where Saruman&#39;s forces came for you. {if merryPippinFellFromMountain=1:Merry and Pippin died here.}{if eaglesComing=1:The eagles carried you safely across, but a rogue bird began stalking you.}}</p>\n<p>{if choicePath=1:You entered the Mines of Moria. Gandalf fell into darkness here, saving you from a Balrog. {if stabbedBySpear=1:You yourself were stabbed by a troll and carried out, barely alive.}}</p>\n<p>The Fellowship went through Lothlorien, received gifts from Lady Galadriel, and rowed downriver towards the hills of Amon Hen, near the Gondor bordor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship sets off in their boats.\" role=\"link\" tabindex=\"0\">Your journey begins at the Gates of Argonath.</a></p>",
		'passages': {
		},
	},
	'Go back': {
		'clear': true,
		'text': "<p>{Try again?}</p>",
		'passages': {
		},
	},
	'Begin a New Adventure': {
		'clear': true,
		'text': "<p>This story will begin in the Shire.</p>\n<p>Months have passed since your Uncle Bilbo left Hobbiton and entitled his home of Bag End to you. It&#39;s also been months since the wizard Gandalf rambled on about Bilbo&#39;s prized ring being the source of all evil and ran off to who-knows-where, but you haven&#39;t given him much thought since then.</p>\n<p>You&#39;re now settling in for a quiet evening. You ponder if you should have your routine cup of <a class=\"squiffy-link link-section\" data-section=\"apple-rose tea\" role=\"link\" tabindex=\"0\">apple-rose tea</a>, or be daring with some <a class=\"squiffy-link link-section\" data-section=\"toast and raspberry jam.\" role=\"link\" tabindex=\"0\">toast and raspberry jam.</a></p>",
		'passages': {
		},
	},
	'toast and raspberry jam.': {
		'text': "<p>You get out some Hobbit bread and spread some raspberry jam onto it.</p>\n<p>As you do this, you are startled to hear a loud rap at the door.</p>\n<p>You drop the jar of jam on the floor. The jar doesn&#39;t break, but the jam still makes a terrible mess.</p>\n<p>&quot;Frodo, <a class=\"squiffy-link link-section\" data-section=\"open up\" role=\"link\" tabindex=\"0\">open up</a>!&quot; a familiar voice shouts from behind the door. &quot;Don&#39;t <a class=\"squiffy-link link-section\" data-section=\"leave an old wizard waiting!\" role=\"link\" tabindex=\"0\">leave an old wizard waiting!</a>&quot;</p>",
		'attributes': ["jam = 1"],
		'passages': {
		},
	},
	'apple-rose tea': {
		'text': "<p>You put a kettle on and eagerly wait for it to boil.</p>\n<p>As you wait, you suddenly hear a loud rap at the door.</p>\n<p>&quot;Frodo, <a class=\"squiffy-link link-section\" data-section=\"open up\" role=\"link\" tabindex=\"0\">open up</a>!&quot; a familiar voice shouts. &quot;Don&#39;t <a class=\"squiffy-link link-section\" data-section=\"leave an old wizard waiting!\" role=\"link\" tabindex=\"0\">leave an old wizard waiting!</a>&quot;</p>",
		'passages': {
		},
	},
	'leave an old wizard waiting!': {
		'text': "<p>The rapping is getting louder.</p>\n<p>&quot;Frodo Baggins, don&#39;t <a class=\"squiffy-link link-section\" data-section=\"keep me out in the cold\" role=\"link\" tabindex=\"0\">keep me out in the cold</a>!&quot; the old wizard shouts. &quot;You need to <a class=\"squiffy-link link-section\" data-section=\"open up\" role=\"link\" tabindex=\"0\">open up</a> this door right away!&quot;</p>",
		'passages': {
		},
	},
	'keep me out in the cold': {
		'text': "<p>His rapping gets more aggressive. </p>\n<p>&quot;I see you through the window!&quot; he bellows. &quot;If you don&#39;t <a class=\"squiffy-link link-section\" data-section=\"open up\" role=\"link\" tabindex=\"0\">open up</a> this blasted door, I&#39;ll blast it down myself!&quot;</p>\n<p>You wonder if you should <a class=\"squiffy-link link-section\" data-section=\"close the curtains.\" role=\"link\" tabindex=\"0\">close the curtains.</a></p>",
		'attributes': ["gandalfAngry+=1"],
		'passages': {
		},
	},
	'close the curtains.': {
		'text': "<p>You shut the curtains. Now Gandalf cannot see you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">The rapping stops and there is a long, unsettling pause.</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>You are caught by surprise as your front entrance bursts open in a blast of magical light. The intimidating frame of Gandalf the Grey enters your home and he doesn&#39;t seem pleased about burning a spell slot on your front door.</p>\n<p>Now seems like a good time to <a class=\"squiffy-link link-section\" data-section=\"welcome Gandalf into your home.\" role=\"link\" tabindex=\"0\">welcome Gandalf into your home.</a></p>",
		'attributes': ["gandalfLockedOut = 1","gandalfAngry+=1"],
		'passages': {
		},
	},
	'open up': {
		'text': "<p>You open the door and <a class=\"squiffy-link link-section\" data-section=\"welcome Gandalf into your home.\" role=\"link\" tabindex=\"0\">welcome Gandalf into your home.</a></p>",
		'passages': {
		},
	},
	'welcome Gandalf into your home.': {
		'text': "<p>You pleasantly greet Gandalf and offer him a seat.</p>\n<p>{if gandalfLockedOut=1:&quot;I haven&#39;t time for your nonsense!&quot; Gandalf snaps, &quot;I&#39;m on a mission of the utmost importance!&quot;}</p>\n<p>{if gandalfLockedOut=0:&quot;No time for pleasantries, I&#39;m afraid,&quot; Gandalf says, &quot;I&#39;m on a mission of the utmost importance.&quot;}</p>\n<p>He gestures to your uncle&#39;s Ring on the fireplace mantle and begins spouting skimmable exposition.</p>\n<p>&quot;Your uncle acquired that Ring during his quest to Lonely Mountain,&quot; Gandalf explains. &quot;Little did he know it is the One Ring To Rule Them All, tainted with the pure hatred of the Dark Lord, Sauron. Now the realm of Mordor is amassing forces to seek it out, and they know it&#39;s here in the Shire.&quot;</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"take the Ring\" role=\"link\" tabindex=\"0\">take the Ring</a> from the mantle and wonder how to <a class=\"squiffy-link link-section\" data-section=\"get rid of it\" role=\"link\" tabindex=\"0\">get rid of it</a>.</p>",
		'passages': {
		},
	},
	'get rid of it': {
		'text': "<p>You offer it to Gandalf, telling him to go throw it in the ocean or something.</p>\n<p>&quot;You must not offer it to anyone,&quot; Gandalf begs. &quot;It tempts people to use its power for good, but it only corrupts them with its evil. But you&#39;ve had it all along and seem unaffected by its power - YOU must <a class=\"squiffy-link link-section\" data-section=\"take the Ring\" role=\"link\" tabindex=\"0\">take the Ring</a>!&quot;</p>",
		'passages': {
		},
	},
	'take the Ring': {
		'text': "<p>&quot;We&#39;ll take the Ring to Rivendell and consult with King Elrond,&quot; Gandalf says. &quot;I need to go see Saruman the Wise at Isengard, so you&#39;ll need to journey to Bree on your own. I&#39;ll meet you at the Prancing Pony Inn. There are spies about, so sign in under the name Mr. Underhill.&quot;</p>\n<p>&quot;All of Middle-Earth depends on your success. Do you <a class=\"squiffy-link link-section\" data-section=\"accept this quest\" role=\"link\" tabindex=\"0\">accept this quest</a>, or <a class=\"squiffy-link link-section\" data-section=\"refuse it?\" role=\"link\" tabindex=\"0\">refuse it?</a>&quot;</p>",
		'passages': {
		},
	},
	'refuse it?': {
		'text': "<p>You get infuriated and tell Gandalf off. Magic rings? Dark Lords? Pony spies? You won&#39;t be dragged into this wizard&#39;s shenanigans like Uncle Bilbo did!</p>\n<p>&quot;Frodo Baggins, the fate of Middle-Earth is at stake !&quot; Gandalf exclaims, &quot;You can&#39;t <a class=\"squiffy-link link-section\" data-section=\"outright refuse\" role=\"link\" tabindex=\"0\">outright refuse</a> to save it! You must <a class=\"squiffy-link link-section\" data-section=\"accept this quest\" role=\"link\" tabindex=\"0\">accept this quest</a>! The Black Riders are on their way!&quot;</p>",
		'attributes': ["gandalfAngry+=1"],
		'passages': {
		},
	},
	'accept this quest': {
		'text': "<p>You tell Gandalf you&#39;ll accept this quest, but are fearful of making the journey alone, as you&#39;ve never been outside the Shire.</p>\n<p>&quot;You won&#39;t be alone,&quot; Gandalf says, eyeing your window.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">There is movement in the garden outside.</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>Gandalf reaches through the window and pulls a portly Hobbit into your den. It is your gardener, Samwise Gamgee.</p>\n<p>&quot;Hello, Mr. Frodo!&quot; Sam squeaks, &quot;Don&#39;t mind me; just watering the petunias late at night as I&#39;m oft to do.&quot;</p>\n<p>Gandalf orders Sam to accompany you to Bree. Sam agrees out of sheer confusion, certain that this is all a bad dream.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">You suddenly hear the sounds of approaching hooves.</a></p>",
		'passages': {
		},
	},
	'_continue3': {
		'text': "<p>&quot;We&#39;re too late; the Black Riders are here!&quot; Gandalf says.</p>\n<p>&quot;What do we do?&quot; Sam asks.</p>\n<p>{if jam=1:&quot;I&#39;ll tell you what we do,&quot; Gandalf starts, and then as he crosses the den, he slips on the patch of raspberry jam you spilled earlier. He tumbles to the floor, hitting his head on Bilbo&#39;s mother&#39;s glory box.}</p>\n<p>{if jam=1:Gandalf lies motionless on the ground. You and Sam exchange horrified looks. You wonder if Sam will need his shovel for something other than gardening}</p>\n<p>{if jam=1:The hooves are getting closer. Sam realizes there&#39;s no chance of all three of you getting out of here and quickly throws a blanket over Gandalf. He hopes this will hide him from the Riders.}</p>\n<p>{if jam=0:&quot;Go out the back,&quot; Gandalf says. &quot;I&#39;ll lure the Black Riders away. Go swiftly!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Sam takes you by the arm and hurries out the back door.\" role=\"link\" tabindex=\"0\">Sam takes you by the arm and hurries out the back door.</a></p>",
		'passages': {
		},
	},
	'Sam takes you by the arm and hurries out the back door.': {
		'text': "<p>The two of you hurry away from Bag End on foot. The One Ring remains in your pocket as you run.</p>\n<p>{if jam=0:The sound of hooves grows faint as Gandalf leads the Riders away on his horse.}</p>\n<p>{if jam=1:You hear the Riders shriek in disappointment back at Bag End, and the hooves begin circling around Hobbiton to continue searching for you.}</p>\n<p>Sam doesn&#39;t waste time getting you out of the Shire.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You escape through Farmer's Maggot's field...\" role=\"link\" tabindex=\"0\">You escape through Farmer&#39;s Maggot&#39;s field...</a></p>",
		'passages': {
		},
	},
	'outright refuse': {
		'text': "<p>You tell Gandalf that you would not, will not, shall not undergo this quest. You ask him to kindly show himself out.</p>\n<p>&quot;So be it,&quot; Gandalf grumbles as he steps outside, &quot;But be warned, Frodo Baggins: if that Ring stays in the Shire, there will be dire consequences!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue4\" role=\"link\" tabindex=\"0\">You close the door in his face.</a></p>",
		'attributes': ["gandalfRefusedQuest = 1","gandalfAngry+=1"],
		'passages': {
		},
	},
	'_continue4': {
		'text': "<p>You spend the next few minutes trying to remember what you were doing before Gandalf&#39;s rude interruption.</p>\n<p>{if jam=0:Oh, yes, you were about to have tea.}\n{if jam=1:Oh, yes. You were just about to clean up a nasty jam spill.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue5\" role=\"link\" tabindex=\"0\">As you carry on, you hear a voice at your window.</a></p>",
		'passages': {
		},
	},
	'_continue5': {
		'text': "<p>Your gardener, Samwise Gamgee, was listening in on the conversation. He tells you that Gandalf ran off somewhere in a huff. He fears Gandalf might come back.</p>\n<p>&quot;That wizard&#39;s always been trouble &#39;round here,&quot; Sam says. &quot;I&#39;ll go give the Thain a heads-up in case we need to muster a mob.&quot;</p>\n<p>He runs off and leaves you alone.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue6\" role=\"link\" tabindex=\"0\">You re-assume your nightly do-abouts.</a></p>",
		'passages': {
		},
	},
	'_continue6': {
		'text': "<p>Several minutes pass. You&#39;re too concerned to go to bed, worried that Gandalf might come back, or that Gandalf might be right about the Ring.</p>\n<p>You sit in your armchair in front of the fireplace and notice the Ring is still in your pocket. You strangely feel no desire to replace it on the mantle.</p>\n<p>As you <a class=\"squiffy-link link-section\" data-section=\"admire the Ring\" role=\"link\" tabindex=\"0\">admire the Ring</a>, you hear a noise outside. It sounds like Sam shouting. You wonder if you should <a class=\"squiffy-link link-section\" data-section=\"check on him\" role=\"link\" tabindex=\"0\">check on him</a>.</p>",
		'passages': {
		},
	},
	'admire the Ring': {
		'text': "<p>It&#39;s quite lovely, really. It&#39;s no wonder Uncle Bilbo considers it a prize. The Ring is very plain, and yet uniquely beautiful in its shape. Whoever crafted it had an eye for perfection.</p>\n<p>&quot;Mister Frodo! Mister Frodo!&quot; Sam&#39;s voice snaps you out of your trance. You decide to <a class=\"squiffy-link link-section\" data-section=\"check on him\" role=\"link\" tabindex=\"0\">check on him</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'check on him': {
		'text': "<p>Outside, you see Sam running up the path towards your house, looking fear-stricken in the night. If you&#39;re not mistaken, he&#39;s also covered in blood.</p>\n<p>&quot;They killed the Thain and the Hobbitry!&quot; he shouts. &quot;They&#39;re coming for you! You need to run now!&quot;</p>\n<p>You hear the sound of hooves and see a blade emerge from the shadows behind Sam.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue7\" role=\"link\" tabindex=\"0\">Sam is struck down from behind.</a></p>",
		'passages': {
		},
	},
	'_continue7': {
		'text': "<p>Samwise Gamgee is dead.</p>\n<p>A ghastly horseman in a dark cloak brandishes a vile blade and continues riding towards your home.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue8\" role=\"link\" tabindex=\"0\">You draw the curtain.</a></p>",
		'attributes': ["samDead = 1"],
		'passages': {
		},
	},
	'_continue8': {
		'text': "<p>Traumatized at the death of your long-time friend and favourite gardener, you have little time to think about how to fight back against the Black Rider. Do you <a class=\"squiffy-link link-section\" data-section=\"barricade the door?\" role=\"link\" tabindex=\"0\">barricade the door?</a> Or <a class=\"squiffy-link link-section\" data-section=\"grab a knife from the kitchen?\" role=\"link\" tabindex=\"0\">grab a knife from the kitchen?</a> Maybe <a class=\"squiffy-link link-section\" data-section=\"hide under the sofa?\" role=\"link\" tabindex=\"0\">hide under the sofa?</a></p>",
		'passages': {
		},
	},
	'barricade the door?': {
		'text': "<p>You push a bookshelf in front of the door and hope it holds off the Black Rider.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"It doesn't.\" role=\"link\" tabindex=\"0\">It doesn&#39;t.</a></p>",
		'passages': {
		},
	},
	'grab a knife from the kitchen?': {
		'text': "<p>You grab a butter knife from the kitchen and hope it stands up against the Black Rider&#39;s morgul blade.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"It doesn't.\" role=\"link\" tabindex=\"0\">It doesn&#39;t.</a></p>",
		'attributes': ["hasButterknife = 1"],
		'passages': {
		},
	},
	'hide under the sofa?': {
		'text': "<p>You hide under the sofa and play dead, hoping this strategy will confuse the Black Rider until it goes away.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"It doesn't.\" role=\"link\" tabindex=\"0\">It doesn&#39;t.</a></p>",
		'passages': {
		},
	},
	'It doesn\'t.': {
		'text': "<p>The Black Rider bashes down your front door and comes directly for you. You are trapped in your home, about to be struck down like a trapped rabbit.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue9\" role=\"link\" tabindex=\"0\">A flash of light erupts through your home.</a></p>",
		'passages': {
		},
	},
	'_continue9': {
		'text': "<p>Gandalf emerges from your kitchen, blasting the Black Rider with sunlight from his staff. The Black Rider recoils in horror and flees Bag End.</p>\n<p>&quot;Out the back door, quickly!&quot; he shouts. &quot;Take the Ring and go to our meeting place, I&#39;ll hold off the Riders.&quot;</p>\n<p>{if jam=1:As he runs off to confront the Riders, he slips on the jam you spilled earlier and lands head-first on Bilbo&#39;s mother&#39;s glory box. He lays unconscious on the floor.}</p>\n<p>{if jam=1:Gandalf is unresponsive, so you roll him under the sofa, hope the Riders don&#39;t find him there, and focus on saving on your own hide.}</p>\n<p>{if jam=0:He races out the door, firing bolts of concentrated sunlight at the other Riders approaching Bag End.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue10\" role=\"link\" tabindex=\"0\">You then remember you don&#39;t have a back door.</a></p>",
		'passages': {
		},
	},
	'_continue10': {
		'text': "<p>It turns out Gandalf blasted open a hole in the wall to come save you. You escape out the newly-made hole and hurry out of the Shire on foot.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You escape through Farmer's Maggot's field...\" role=\"link\" tabindex=\"0\">You escape through Farmer&#39;s Maggot&#39;s field...</a></p>",
		'passages': {
		},
	},
	'You escape through Farmer\'s Maggot\'s field...': {
		'text': "<p>{if samDead=0:...and run into your friends, Merry and Pippin. They&#39;re stealing vegetables from the field.}</p>\n<p>{if samDead=0:&quot;Oh, hello, Frodo and Sam!&quot; Merry sings. &quot;Fancy a carrot?&quot;}</p>\n<p>{if samDead=0:&quot;No time to chat,&quot; Sam says, &quot;On a secret mission!&quot;}</p>\n<p>{if samDead=0:&quot;Really? <a class=\"squiffy-link link-section\" data-section=\"Can we come?\" role=\"link\" tabindex=\"0\">Can we come?</a>&quot; asks Pippin. &quot;Or should we mind our own business and <a class=\"squiffy-link link-section\" data-section=\"go home?\" role=\"link\" tabindex=\"0\">go home?</a>&quot;}</p>\n<p>{if samDead=1:...and barely miss your friends, Merry and Pippin, who are out late stealing vegetables from the field. You shout a warning to them about the Black Riders, but they&#39;re already heading back to Hobbiton. You hope they get home safely.}</p>\n<p>{if samDead=1:<a class=\"squiffy-link link-section\" data-section=\"You take a shortcut through a mushroom patch...\" role=\"link\" tabindex=\"0\">You take a shortcut through a mushroom patch...</a>}</p>",
		'passages': {
		},
	},
	'go home?': {
		'text': "<p>You tell the two Hobbits to get home quickly and safely, as the Black Riders are still about.</p>\n<p>&quot;All righty, then,&quot; says Merry. And the two Hobbits bugger off.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You take a shortcut through a mushroom patch...\" role=\"link\" tabindex=\"0\">You take a shortcut through a mushroom patch...</a></p>",
		'passages': {
		},
	},
	'Can we come?': {
		'text': "<p>You invite Merry and Pippin to join you. You now have two more Hobbits following you and Sam.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You take a shortcut through a mushroom patch...\" role=\"link\" tabindex=\"0\">You take a shortcut through a mushroom patch...</a></p>",
		'attributes': ["merryPippinCome = 1"],
		'passages': {
		},
	},
	'You take a shortcut through a mushroom patch...': {
		'text': "<p>...and escape into the forest, heading towards Bree.</p>\n<p>{if merryPippinCome=1:Merry and Pippin are delighted to be here, despite knowing nothing of your mission or the threat pursuing you.}</p>\n<p>{if samDead=0:Sam eagerly moves on looking for the Brandybuck ferry, which will take you to Bree.}</p>\n<p>{if samDead=1:Your heart is racing and your feet ache from running. Without Gandalf, you feel so alone and helpless out here in the wild. You have no companions, no survival skills, and no chance against the Black Riders if they find you. {if hasButterknife=1:Not even with your butter knife.}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue11\" role=\"link\" tabindex=\"0\">You then run into a strange man named Tom Bombadil.</a></p>",
		'passages': {
		},
	},
	'_continue11': {
		'text': "<p>{if samDead=0:Your encounter with Tom is strange, brief, and unsubstantial. He dances, smokes some pipe-weed, and muses himself at the sight of your Ring. But he&#39;s ultimately uninterested in {if merryPippinJoin=1:your party}{if merryPippinJoin=0:you and Sam} and leaves your group.}</p>\n<p>{if samDead=0:Perhaps in another life, this encounter may have turned out differently.}</p>\n<p>{if samDead=0:&quot;We&#39;ve wasted too much time,&quot; Sam says. &quot;The Riders are still about. We should either get through these woods <a class=\"squiffy-link link-section\" data-section=\"quickly\" role=\"link\" tabindex=\"0\">quickly</a> or <a class=\"squiffy-link link-section\" data-section=\"quietly\" role=\"link\" tabindex=\"0\">quietly</a>.&quot;}</p>\n<p>{if samDead=1:Your encounter with Tom is a delightful romp. He chases away a nasty spirit with a song, dances a jig, and shares some pipe-weed with you. He casually escorts you through the forest.} </p>\n<p>{if samDead=1:But your heart is still heavy with fear and doubt. You express your regrets for what happened to Sam and the other Hobbits and wish Bilbo had never found this accursed Ring.}</p>\n<p>{if samDead=1:&quot;Oy, lad, don&#39;t <a class=\"squiffy-link link-section\" data-section=\"let life get ya down\" role=\"link\" tabindex=\"0\">let life get ya down</a>. When the world gives ya trouble, just <a class=\"squiffy-link link-section\" data-section=\"put a song in your heart!\" role=\"link\" tabindex=\"0\">put a song in your heart!</a>&quot; Tom exclaims as he produces the Ring from his palm, somehow snatching it from your pocket. &quot;Wish upon a star, Bob&#39;s your uncle, and Hakuna Matata! Don&#39;t worry, be happy and ye can be yer own master, dontcha know?&quot;}</p>",
		'passages': {
		},
	},
	'put a song in your heart!': {
		'text': "<p>You hum a few bars of a happy Shire tune. Tom insists you sing it from the diaphragm and gives you a few singing lessons. &quot;Deeper! Louder! Let the forest hear your song!&quot;</p>\n<p>You dig down deep within your soul and let your voice echo through the trees. Soon, you&#39;re marching through the woods, singing about country roads and good times. You feel a renewed sense of courage and commitment to your quest.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You also attract the attention of the Black Riders.\" role=\"link\" tabindex=\"0\">You also attract the attention of the Black Riders.</a></p>",
		'attributes': ["learnedTomsSong = 1"],
		'passages': {
		},
	},
	'let life get ya down': {
		'text': "<p>You don&#39;t feel like whistling a happy song or forgetting your worries. You lost friends today and now carry the fate of Middle-Earth in your pocket. You want to feel terrible because things ARE terrible and you don&#39;t want to lose sight of what&#39;s important.</p>\n<p>Tom shrugs and accepts your realistic outlook. He doesn&#39;t have much to say on that matter, but he has nothing to teach you now either. He sees you want to be on a different path.</p>\n<p>You kick a rock into a puddle to express your frustration.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You also attract the attention of the Black Riders.\" role=\"link\" tabindex=\"0\">You also attract the attention of the Black Riders.</a></p>",
		'passages': {
		},
	},
	'You also attract the attention of the Black Riders.': {
		'text': "<p>&quot;Stand back, boy,&quot; Tom says as a ferocious black steed storms down the road towards you. &quot;I&#39;m going to borrow that silly piece of jewelry again.&quot;</p>\n<p>Tom produces the One Ring and holds it up to the moonlight. The light shines off the Ring into the horse&#39;s eyes, causing the horse to panic and veer under a low hanging branch. The Black Rider is knocked to the ground.</p>\n<p>The horse rides up to you and Tom. Tom gracefully mounts the creature and offers you a hand up. &quot;Care for a lift?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue12\" role=\"link\" tabindex=\"0\">The Black Rider screams in protest as you and Tom steal its ride.</a></p>",
		'passages': {
		},
	},
	'_continue12': {
		'text': "<p>You take the scenic route through the woods and around the river, staying ahead of the Riders at every turn. Along the way, Tom gives you tips on staying upbeat and always picking the right song for karaoke. {if learnedTomsSong=0:You tune most of it out.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue13\" role=\"link\" tabindex=\"0\">A couple days later, you arrive at Bree.</a></p>",
		'passages': {
		},
	},
	'_continue13': {
		'text': "<p>{if learnedTomsSong=0:As you approach, Tom says, &quot;Well, here we are, boy. I hope you find what&#39;s you&#39;re looking for, even without a happy song in your heart.&quot;}</p>\n<p>{if learnedTomsSong=1:As you approach, Tom says, &quot;Now, Frodo, boy, I need to warn ya that you&#39;ll be asked of a lot in the coming days. But if you want to see it through with smiles on the other end, you need to drop the secrecy, forget violence, and share the wealth. Your voice will be the only weapon you need.&quot;}</p>\n<p>{if learnedTomsSong=1:{if hasButterknife=1:He eyes the butter knife you&#39;re carrying. You consider <a class=\"squiffy-link link-passage\" data-passage=\"handing it over.\" role=\"link\" tabindex=\"0\">handing it over.</a>}}</p>\n<p>&quot;Now, <a class=\"squiffy-link link-section\" data-section=\"shall we part ways?\" role=\"link\" tabindex=\"0\">shall we part ways?</a>&quot;</p>",
		'passages': {
			'handing it over.': {
				'text': "<p>You pass the butter knife to Tom. Tom casually tosses it into the river. He smiles and nods to you, as if you&#39;ve just taken the first step towards greatness.</p>",
				'attributes': ["hasButterknife = 0"],
			},
		},
	},
	'shall we part ways?': {
		'text': "<p>You dismount from the horse and say goodbye to Tom. He rides off.</p>\n<p>Rain falls as you enter the town of Bree. You hope that Gandalf managed to make it here, as planned. You search the town until you find the Prancing Pony Inn.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the inn.\" role=\"link\" tabindex=\"0\">You enter the inn.</a></p>",
		'passages': {
		},
	},
	'quickly': {
		'text': "<p>That&#39;s the spirit!</p>\n<p>Hollering at the top of your lungs, you barge through the woods as quickly and loudly as possible.</p>\n<p>While you scare away any local wildlife, you eventually hear the shriek of a Black Rider as it pinpoints your location and charges towards your group in the darkness.</p>\n<p>Spying over your shoulder, you see several black mares emerge through the shadows. Atop each evil steed rides a faceless, cloaked figure carrying a Morgul blade.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue14\" role=\"link\" tabindex=\"0\">The hooves rapidly approach.</a></p>",
		'passages': {
		},
	},
	'_continue14': {
		'text': "<p>{if merryPippinCome=0:But your small numbers work in your advantage. You and Sam dodge and weave through the tree cracks, forcing the Riders to give you a wide berth as you cross into denser wood. One Rider dares to approach too close, and gets knocked off his horse by a low-hanging branch.}</p>\n<p>{if merryPippinCome=0:<a class=\"squiffy-link link-section\" data-section=\"You and Sam easily find the Brandybuck River and hop aboard the ferry.\" role=\"link\" tabindex=\"0\">You and Sam easily find the Brandybuck River and hop aboard the ferry.</a>}</p>\n<p>{if merryPippinCome=1:There&#39;s a flash of a blade and Merry falls dead to the ground. The horse races past and circles around for another go. Pippin is in tears. He wants to <a class=\"squiffy-link link-section\" data-section=\"stop and grieve\" role=\"link\" tabindex=\"0\">stop and grieve</a> for his best friend. Sam wants to <a class=\"squiffy-link link-section\" data-section=\"get to the ferry\" role=\"link\" tabindex=\"0\">get to the ferry</a>.}</p>\n<p>{if merryPippinCome=1:{@merryDead=1}}</p>",
		'passages': {
		},
	},
	'stop and grieve': {
		'text': "<p>The Black Rider returns and slices Pippin&#39;s head clean off.</p>\n<p>This adventure isn&#39;t off to a great start.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Sam grabs you and makes a beeline for the ferry.\" role=\"link\" tabindex=\"0\">Sam grabs you and makes a beeline for the ferry.</a></p>",
		'attributes': ["pippinDead = 1"],
		'passages': {
		},
	},
	'quietly': {
		'text': "<p>Hobbits are quite good at sneaking and you easily pass through the forest without attracting any attention.</p>\n<p>Soon, you spy a dark, cloaked figure atop a horse in the foggy distance. The Black Rider is a grim, menacing creature brandishing a Morgul blade.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue15\" role=\"link\" tabindex=\"0\">Sam leads you to hide in the cracks of a large tree.</a></p>",
		'passages': {
		},
	},
	'_continue15': {
		'text': "<p>You and {if merryPippinCome=1:the other three Hobbits}{if merryPippinCome=0:Sam} stay still and quiet within the cracks of the tree as the Black Rider passes by. You hear several other mounts accompany it as they comb the forest searching for you.</p>\n<p>You hear the voice of the Ring whispering to you. It wants to be worn. It can protect you from the Riders.</p>\n<p>Maybe you should <a class=\"squiffy-link link-section\" data-section=\"put on the Ring?\" role=\"link\" tabindex=\"0\">put on the Ring?</a> Or <a class=\"squiffy-link link-section\" data-section=\"maybe put on the Ring just a little?\" role=\"link\" tabindex=\"0\">maybe put on the Ring just a little?</a></p>",
		'passages': {
		},
	},
	'put on the Ring?': {
		'text': "<p>Sam reaches over and swats the Ring out of your hand, mouthing &quot;No-no-no-no!&quot;</p>\n<p>The Rider shrieks as if it felt Sam&#39;s swat. Moments later, it races away towards some unseen target.</p>\n<p>Once the Rider is far away, you gather the Ring and head to the River.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You safely board the ferry without trouble.\" role=\"link\" tabindex=\"0\">You safely board the ferry without trouble.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'maybe put on the Ring just a little?': {
		'text': "<p>As the Ring approaches your finger, the Rider senses your fear and approaches your hiding spot. </p>\n<p>Sam quickly pulls your hand back, disorienting the Rider as it no longer senses the Ring&#39;s calling. It rides off in search of you elsewhere.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You safely board the ferry without trouble.\" role=\"link\" tabindex=\"0\">You safely board the ferry without trouble.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'get to the ferry': {
		'text': "<p>The three of you find the ferry and paddle away feverishly as the Riders mount another attack. Their blades barely miss you from shore, and rather than risk drowning their horses, they head upriver in search of a bridge.</p>\n<p>You are safe for now.</p>\n<p>&quot;He&#39;s dead!&quot; chokes Pippin, &quot;My best friend is dead! All he wanted was carrots! And now he&#39;s gone to the big carrot farm in the sky!&quot;</p>\n<p>Sam awkwardly pats him on the back. He assures Pippin, &quot;He was a brave Hobbit. We&#39;ll come back and give him a proper burial if the wolves don&#39;t get to him first.&quot;</p>\n<p>Pippin cries harder.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You finish your journey to Bree.\" role=\"link\" tabindex=\"0\">You finish your journey to Bree.</a></p>",
		'attributes': ["merryStillAlive = 0","pippinSurvived = 1"],
		'passages': {
		},
	},
	'Sam grabs you and makes a beeline for the ferry.': {
		'text': "<p>You hop aboard the ferry and paddle furiously as the Riders come at you yet again. Fortunately, their horses cannot swim the deep waters and they ride upriver in search of the nearest bridge.</p>\n<p>&quot;Merry and Pippin are gone!&quot; Sam exclaims, &quot;Did you see what those Riders did? I&#39;ve never seen so much blood come out of two Hobbits!&quot;</p>\n<p>You say that this is all your fault. You knew the Riders were pursuing this Ring and you still invited your friends to come along.</p>\n<p>&quot;Then we&#39;ll finish the mission and return home,&quot; Sam says. &quot;We&#39;ll see to it Merry and Pippin didn&#39;t die for nothing.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You finish your journey to Bree.\" role=\"link\" tabindex=\"0\">You finish your journey to Bree.</a></p>",
		'passages': {
		},
	},
	'You and Sam easily find the Brandybuck River and hop aboard the ferry.': {
		'text': "<p>As you pull away from shore, the Riders give up the chase and head upriver in search of a bridge. You&#39;ve successfully escaped the Riders for now.</p>\n<p>&quot;That was exciting!&quot; Sam says, &quot;I knew never my little Hobbit feet could carry me so fast!&quot;</p>\n<p>You tell Sam you feel like you&#39;ve just had your first taste of true adventure and can&#39;t wait to see what lies ahead.</p>\n<p>Sam smiles. &quot;Let&#39;s keep going. We&#39;ve outsmarted those Riders once; we can do it again.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You finish your journey to Bree.\" role=\"link\" tabindex=\"0\">You finish your journey to Bree.</a></p>",
		'passages': {
		},
	},
	'You safely board the ferry without trouble.': {
		'text': "<p>The {if merryPippinCome=1:four}{if merryPippinCome=0:two} of you hop aboard the ferry and paddle away from the shore. The Riders are still lost in the woods searching for you.</p>\n<p>{if merryPippinCome=1:&quot;That was terrifying,&quot; Merry says. &quot;Hope we don&#39;t run into them again.&quot;}</p>\n<p>{if merryPippinCome=1:{@merryStillAlive=1}}</p>\n<p>{if merryPippinCome=1:Pippin chimes in, &quot;I&#39;m sure they&#39;re long gone and it&#39;s smooth sailing ahead. How many more dangers can there be between here and Rivendell?&quot;}</p>\n<p>{if merryPippinCome=1:Sam is delighted at the team spirit on this ferry.}</p>\n<p>{if merryPippinCome=0:&quot;That wasn&#39;t so bad,&quot; Sam says. &quot;If we keep our wits up and stay light on our feet, the Riders will never get the jump on us.&quot;}</p>\n<p>{if merryPippinCome=0:You agree and imagine the worst is behind you.}</p>\n<p>You pet your Ring a little.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You finish your journey to Bree.\" role=\"link\" tabindex=\"0\">You finish your journey to Bree.</a></p>",
		'passages': {
		},
	},
	'You finish your journey to Bree.': {
		'text': "<p>Because of your inability to navigate a raft properly, it takes days to reach Bree. The Riders race past you on shore several times, on both sides of the river, trying to determine where you plan to make dock. Eventually, a heavy rain allows you to double-back on them and find your way to the town of Bree.</p>\n<p>At this point, you&#39;re certain that you&#39;ve kept Gandalf waiting too long as you approach the Prancing Pony Inn.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the inn.\" role=\"link\" tabindex=\"0\">You enter the inn.</a></p>",
		'passages': {
		},
	},
	'You enter the inn.': {
		'text': "<p>Inside, the innkeeper looks down at you from over the counter and says, &quot;Welcome to the Prancing Pony.&quot;</p>\n<p>You greet the man and tell him you&#39;re here to see a wizard-type fellow with a pointy hat.</p>\n<p>&quot;Can I get your name?&quot;</p>\n<p>You wonder if you should <a class=\"squiffy-link link-section\" data-section=\"give him a fake name\" role=\"link\" tabindex=\"0\">give him a fake name</a> or just <a class=\"squiffy-link link-section\" data-section=\"stick with being a Baggins?\" role=\"link\" tabindex=\"0\">stick with being a Baggins?</a></p>",
		'passages': {
		},
	},
	'give him a fake name': {
		'text': "<p>Perhaps it&#39;s wise to stick with Gandalf&#39;s plan, you think.</p>\n<p>You tell him your name is Underhill. The innkeeper seems nonplussed by the name as he checks his registry.</p>\n<p>{if jam=0:&quot;There&#39;s no Underhill listed here,&quot; he says, &quot;but feel free to see if your friend is in the tavern.}{if jam=1:&quot;Ah, yes, Underhill,&quot; he says, &quot;your wizard friend came in a few days ago. He should be in the tavern.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the inn's tavern.\" role=\"link\" tabindex=\"0\">You enter the inn&#39;s tavern.</a></p>",
		'attributes': ["gaveFakeName = 1"],
		'passages': {
		},
	},
	'stick with being a Baggins?': {
		'text': "<p>You decide there&#39;s no harm in giving your real name.</p>\n<p>You proudly declare you are Frodo Baggins of the Shire.</p>\n<p>&quot;Baggins, you say???&quot; the innkeeper&#39;s eyes light up. He glares towards the window and scratches his nose. The town guardsman outside acknowledges his scratch with a wiggle of his ear and runs off.</p>\n<p>You inquire about that suspicious exchange.</p>\n<p>&quot;Oh, nothing, nothing,&quot; the innkeeper says. &quot;I don&#39;t have a Baggins listed here, but feel free to step into the tavern and see if you can spot your wizard friend.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the inn's tavern.\" role=\"link\" tabindex=\"0\">You enter the inn&#39;s tavern.</a></p>",
		'passages': {
		},
	},
	'You enter the inn\'s tavern.': {
		'text': "<p>The tavern is rowdy with patrons as you enter and find a seat.</p>\n<p>{if merryStillAlive=1:Merry sees a man walk by with a large pint of beer. He and Pippin eagerly rush off to order pints for themselves.}</p>\n<p>{if pippinSurvived=1:Pippin sees a man walk by with a large pint of beer. He decides to go drown his sorrows over poor Merry&#39;s death.}</p>\n<p>{if samDead=0:&quot;Any sign of the old wizard?&quot; Sam asks.}</p>\n<p>{if jam=0:Your eyes scan the room, but you don&#39;t see Gandalf anywhere. You fear something terrible has happened to him.}</p>\n<p>{if jam=0:You suddenly grow very concerned. Your hand clutches the Ring out of fear. The Ring feels warm and comforting to the touch. At the moment, it seems to be the only thing you can trust right now.{if samDead=0: That includes Sam in front of you.}} {if learnedTomsSong=1:You try to hum a cheerful song, but you&#39;re suddenly not feeling it.}</p>\n<p>{if jam=0:You <a class=\"squiffy-link link-section\" data-section=\"inspect the Ring\" role=\"link\" tabindex=\"0\">inspect the Ring</a> and briefly consider <a class=\"squiffy-link link-section\" data-section=\"trying the Ring on\" role=\"link\" tabindex=\"0\">trying the Ring on</a>. Maybe it&#39;ll make you feel better.}</p>\n<p>{if jam=1:Suddenly, a tall bearded man in a grey robe with a pointy hat sits with you.}</p>\n<p>{if jam=1:&quot;You&#39;re late,&quot; Gandalf says. &quot;I&#39;ve been waiting two days for you. You would behoove yourself to move a little faster next time and not keep an old man waiting.&quot;}</p>\n<p>{if jam=1:You promise to work on your punctuality and ask about his business with Saruman.}</p>\n<p>{if jam=1:&quot;I didn&#39;t have time to see him. I was unconscious in your home for a whole day. When I awoke, I hurried here. Saruman will have to wait until after we reach Rivendell.&quot;}</p>\n<p>{if jam=1:{if merryDead=1:You tell Gandalf of your journey to Bree. He is gravely sorry for your loss.}}</p>\n<p>{if jam=1:&quot;The Black Riders will come here soon,&quot; Gandalf continues. &quot;This town is no longer safe. We must <a class=\"squiffy-link link-section\" data-section=\"leave Bree\" role=\"link\" tabindex=\"0\">leave Bree</a> immediately and seek refuge at Weathertop.{if gandalfAngry&gt;2: And for heaven&#39;s sake, Frodo, try not to <a class=\"squiffy-link link-section\" data-section=\"act like a stubborn child\" role=\"link\" tabindex=\"0\">act like a stubborn child</a> about it this time.&quot;}}</p>",
		'passages': {
		},
	},
	'act like a stubborn child': {
		'text': "<p>As you leave the tavern, you slowly shuffle your feet behind Gandalf and he has to take you by the hand and pull you out. Just to make it more difficult on him, you decide to go limp and let him drag you through the mud as you leave town. You even <a class=\"squiffy-link link-passage\" data-passage=\"beg and scream for a present at the gift shop\" role=\"link\" tabindex=\"0\">beg and scream for a present at the gift shop</a>.</p>\n<p>Gandalf mutters several wizard swears under his breath as you <a class=\"squiffy-link link-section\" data-section=\"leave Bree\" role=\"link\" tabindex=\"0\">leave Bree</a>.</p>",
		'attributes': ["gandalfAngry+=1","gandalfDragsYouFromBree = 1"],
		'passages': {
			'beg and scream for a present at the gift shop': {
				'text': "<p>You get an &quot;I&#39;m with stupid&quot; T-shirt on your way out. This displeases Gandalf further.</p>",
				'attributes': ["hasTShirt = 1","gandalfAngry+=1"],
			},
		},
	},
	'leave Bree': {
		'text': "<p>{if merryStillAlive=1:Merry and Pippin quickly join you. Soon, you, Gandalf, and three other Hobbits are making your way out of town.}</p>\n<p>{if pippinSurvived=1:Pippin&#39;s already drunk five pints by the time you leave. He stumbles out of Bree with you and the others, drunk and incoherent.}</p>\n<p>{if merryPippinCome=0:{if samDead=0:You and Sam accompany Gandalf out of town, back into the wilds towards Rivendell. Sam has thoughtfully brought a blanket to keep you covered in the rain.}}</p>\n<p>{if merryPippinCome=0:{if samDead=1:You and Gandalf head out of town, back into the wilds towards Rivendell. You get drenched in the cold rain. Gandalf doesn&#39;t even consider casting an umbrella spell.}}</p>\n<p>On the outskirts of Bree, a strange armed man approaches you in the rain. He looks unshaven and battle-hardened. Gandalf introduces him as Strider. &quot;This ranger will be accompanying us to Rivendell. He is a good friend and can be trusted with our mission.&quot;</p>\n<p>&quot;The Black Riders are on the move,&quot; Strider says, &quot;If we hurry now, we may lose them in the storm.&quot;</p>\n<p>{if gaveFakeName=0:Suddenly, <a class=\"squiffy-link link-section\" data-section=\"you hear a shriek in the skies above.\" role=\"link\" tabindex=\"0\">you hear a shriek in the skies above.</a>}</p>\n<p>{if gaveFakeName=1:<a class=\"squiffy-link link-section\" data-section=\"You hurry into the storm.\" role=\"link\" tabindex=\"0\">You hurry into the storm.</a>}</p>",
		'passages': {
		},
	},
	'inspect the Ring': {
		'text': "<p>It really is quite a nice Ring. The gold band is adorned with beautiful Elven writing and is smooth to the touch. It twinkles like a cozy fire.</p>\n<p>You&#39;re so entranced with the Ring, you barely notice it slipping onto your finger. As you do, you remember the Ring&#39;s invisibility powers and quickly pull it off, hoping no one saw you vanish from sight.</p>\n<p>In the dark corner of the tavern, <a class=\"squiffy-link link-section\" data-section=\"a hooded man suddenly stands and approaches your table\" role=\"link\" tabindex=\"0\">a hooded man suddenly stands and approaches your table</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'trying the Ring on': {
		'text': "<p>What the heck, you think to yourself as you pop the Ring. It slides on perfectly, as if it were made for your finger. It&#39;s actually the nicest thing you&#39;ve even worn now that you think about it.</p>\n<p>{if samDead=0:Sam looks up from his drink and glances around the bar. &quot;Mr. Frodo, where did you go?&quot;}</p>\n<p>You now remember the Ring&#39;s invisibility powers and quickly slip it off, hoping no one notices you re-appear.</p>\n<p>{if samDead=0:Well, except Sam. Sam sees you reappear and immediately scolds you. &quot;No, Mr. Frodo! No more wearing the Ring! Bad Ring! Bad Mr. Frodo!&quot;}</p>\n<p>In the dark corner of the tavern, <a class=\"squiffy-link link-section\" data-section=\"a hooded man suddenly stands and approaches your table\" role=\"link\" tabindex=\"0\">a hooded man suddenly stands and approaches your table</a>.</p>",
		'attributes': ["precious+=1","precious+=1"],
		'passages': {
		},
	},
	'a hooded man suddenly stands and approaches your table': {
		'text': "<p>The tall man wears a ranger&#39;s cloak and carries a sword. He introduces himself as &quot;Strider&quot;.</p>\n<p>&quot;Gandalf sent me to escort you to Rivendell in the event that he doesn&#39;t return from Isengard. I can protect you from the Black Riders, but we must leave Bree immediately. Now that you&#39;re here, they&#39;ll be closing in soon.&quot;</p>\n<p>You pack up and <a class=\"squiffy-link link-section\" data-section=\"follow Strider out of Bree\" role=\"link\" tabindex=\"0\">follow Strider out of Bree</a>, into the rainy night.</p>",
		'passages': {
		},
	},
	'follow Strider out of Bree': {
		'text': "<p>{if merryStillAlive=1:Merry and Pippin quickly join you and Sam. Soon, four Hobbits are accompanying this strange man out of town. Nobody gives you a second look, however, suggesting this sight is far more common than it seems.}</p>\n<p>{if pippinSurvived=1:Pippin&#39;s already drunk five pints by the time you pull him off the bar. He stumbles out of Bree with you and Sam, drunk and incoherent.}</p>\n<p>{if merryPippinCome=0:{if samDead=0:You and Sam follow Strider out of town, back into the wilds towards Rivendell. Sam has thoughtfully brought a blanket to keep you covered in the rain.}}</p>\n<p>{if merryPippinCome=0:{if samDead=1:You follow Strider out of town, back into the wilds towards Rivendell. You get drenched in the cold rain. Strider doesn&#39;t give your wetness a second thought.}}</p>\n<p>{if gaveFakeName=0:A mile out of town, <a class=\"squiffy-link link-section\" data-section=\"you hear a shriek in the skies above.\" role=\"link\" tabindex=\"0\">you hear a shriek in the skies above.</a>}</p>\n<p>{if gaveFakeName=1:<a class=\"squiffy-link link-section\" data-section=\"You hurry into the storm.\" role=\"link\" tabindex=\"0\">You hurry into the storm.</a>}</p>",
		'passages': {
		},
	},
	'you hear a shriek in the skies above.': {
		'text': "<p>{if jam=0:Strider}{if jam=1:Gandalf} looks about with terror in his eyes. &quot;No... it cannot be.&quot;</p>\n<p>You see a winged horror descend through the sky and fall upon Bree. People scream in terror as this monster terrorizes the Prancing Pony.</p>\n<p>&quot;This is madness,&quot; {if jam=0:Strider}{if jam=1:Gandalf} says. &quot;That abomination shouldn&#39;t have traveled so far from Mordor. Not unless it was certain the Ring was here. We should move quickly before it sees us.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You hurry into the storm.\" role=\"link\" tabindex=\"0\">You hurry into the storm.</a></p>",
		'passages': {
		},
	},
	'You hurry into the storm.': {
		'text': "<p>After hours or running, Strider recommends you <a class=\"squiffy-link link-section\" data-section=\"make camp on the ruins of Weathertop\" role=\"link\" tabindex=\"0\">make camp on the ruins of Weathertop</a> while he gets his bearings.</p>\n<p>{if samDead=1:{@hobbitGroup=1}}\n{if samDead=0:{if merryPippinCome=0:{@hobbitGroup=2}}}\n{if samDead=0:{if merryPippinCome=1:{if pippinDead=1:{@hobbitGroup=2}}}}\n{if samDead=0:{if merryPippinCome=1:{if merryStillAlive=1:{@hobbitGroup=3}}}}\n{if samDead=0:{if merryPippinCome=1:{if pippinSurvived=1:{@hobbitGroup=4}}}}</p>",
		'passages': {
		},
	},
	'make camp on the ruins of Weathertop': {
		'text': "<p>This nasty old ruin has seen better days, but it&#39;s still a good location for camp. You hide atop a hill, nestled between the old rocks of Weathertop. Strider runs off to scout the area. {if jam=1:Gandalf wanders off to do mysterious wizard stuff, as he&#39;s wont to do.}</p>\n<p>{if hobbitGroup=4:Pippin drunkenly wets his pants and passes out in the rain. You and Sam roll him over so he doesn&#39;t choke on his own vomit.}</p>\n<p>{if samDead=0:&quot;Maybe I&#39;ll make a campfire,&quot; Sam says as he gathers some branches in a pile and sets them alight.} {if hobbitGroup=3:Merry and Pippin cuddle up for warmth nearby.}</p>\n<p>{if samDead=1:You sit quietly in the freezing rain, unsure how to make a campfire. That was always Sam&#39;s thing back home. You miss Sam.}</p>\n<p>A cold chill permeates the air, and your Ring tingles as if <a class=\"squiffy-link link-section\" data-section=\"something is approaching Weathertop\" role=\"link\" tabindex=\"0\">something is approaching Weathertop</a>.</p>",
		'passages': {
		},
	},
	'something is approaching Weathertop': {
		'text': "<p>And sure enough, your Ring is right. Five Black Riders arrive at the base of Weathertop, dismount their horses, and head up its stairs towards you.</p>\n<p>You&#39;re trapped atop this hill. You think now might be a good time to <a class=\"squiffy-link link-section\" data-section=\"wear the Ring and turn invisible\" role=\"link\" tabindex=\"0\">wear the Ring and turn invisible</a>, but maybe it&#39;s time you stood up to <a class=\"squiffy-link link-section\" data-section=\"face these foes?\" role=\"link\" tabindex=\"0\">face these foes?</a> At least long enough for help to arrive?</p>",
		'passages': {
		},
	},
	'face these foes?': {
		'text': "<p>You stand your ground in the storm. {if samDead=0:Sam stands besides you, next to his campfire. {if hobbitGroup=3: Merry and Pippin rally with you, ready to fight with some rocks they found.}{if hobbitGroup=4: Pippin continues to sleep in the mud.}}</p>\n<p>The five Riders arrive at the top of the hill. Their chief steps forward. They sense the Ring&#39;s presence{if samDead=0:, but can&#39;t get a lock on which Hobbit carries it.}{if samDead=1: on you.}</p>\n<p>You wonder if you should try to <a class=\"squiffy-link link-section\" data-section=\"stall for time\" role=\"link\" tabindex=\"0\">stall for time</a>, or take a chance and <a class=\"squiffy-link link-section\" data-section=\"come out swinging\" role=\"link\" tabindex=\"0\">come out swinging</a>. </p>\n<p>{if hasButterknife=1:You could also <a class=\"squiffy-link link-section\" data-section=\"make use of that butterknife\" role=\"link\" tabindex=\"0\">make use of that butterknife</a> you&#39;re carrying.}{if hasButterknife=0:{if learnedTomsSong:In the back of your head, you hear Tom Bombadil&#39;s voice reminding you to <a class=\"squiffy-link link-section\" data-section=\"share the wealth\" role=\"link\" tabindex=\"0\">share the wealth</a>.}}</p>",
		'passages': {
		},
	},
	'come out swinging': {
		'text': "<p>{if samDead=0:You grab a flaming branch from Sam&#39;s campfire.}{if samDead=1:You grab a small rock from the ground.} With it, you lunge at the Riders.</p>\n<p>{if samDead=0:The fire takes the Riders by surprise. They back away from the flames, uncertain of this threat. Sam joins in{if hobbitGroup=3:, as do Merry and Pippin}.}</p>\n<p>{if samDead=0:You&#39;re able to hold back the Riders for a matter of seconds. Their eyes don&#39;t adjust to the light well, and all they can do is form a perimeter around you.}</p>\n<p>{if samDead=0:<a class=\"squiffy-link link-section\" data-section=\"Strider then strikes from the shadows.\" role=\"link\" tabindex=\"0\">Strider then strikes from the shadows.</a>}</p>\n<p>{if samDead=1:The rock is ineffective. The chief grabs your arm and throws you to the mud. He then <a class=\"squiffy-link link-section\" data-section=\"plunges his morgul blade into your shoulder\" role=\"link\" tabindex=\"0\">plunges his morgul blade into your shoulder</a>.}</p>",
		'passages': {
		},
	},
	'stall for time': {
		'text': "<p>You call for a time-out, making a T-shape with your hands. The Riders stop in their tracks.</p>\n<p>You insist you all just sit and talk about this; maybe work out a deal or trade. You inquire as to whether the Riders might like something other than the Ring, like new cloaks or a nice hat. {if hobbitGroup=1:The Riders ignore your nonsense, because the only thing in their sights is the Ring.}{if hobbitGroup=3:Merry and Pippin like where you&#39;re going with this, and chime in by offering the Riders free tickets to their live improv show. The Riders seem delighted by your goofs.} {if hobbitGroup=2:Sam sweetens the sales pitch by offering a pair of slippers he purchased in Bree. This gives the Riders pause. They are indeed very nice slippers.}{if hobbitGroup=4:Pippin belches loudly, leaving everyone in a stunned silence. The Riders are not feeling this sale.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Strider then strikes from the shadows.\" role=\"link\" tabindex=\"0\">Strider then strikes from the shadows.</a></p>",
		'passages': {
		},
	},
	'make use of that butterknife': {
		'text': "<p>You brandish your butterknife and lunge at the chief.</p>\n<p>This goes about as well as expected. Moments later, you are short one butterknife and face down in the mud. The chief <a class=\"squiffy-link link-section\" data-section=\"plunges his morgul blade into your shoulder\" role=\"link\" tabindex=\"0\">plunges his morgul blade into your shoulder</a>.</p>",
		'attributes': ["hasButterknife = 0"],
		'passages': {
		},
	},
	'share the wealth': {
		'text': "<p>You produce the Ring from your pocket. The Riders shriek and slowly reach towards you.</p>\n<p>Then, in a surprising turn, you toss the Ring their way. The Ring falls at the chief&#39;s feet, bounces off a stone, and goes through his legs. All the Riders bend down to grab it at once and bump into each other&#39;s heads.</p>\n<p>The Riders stumble and fall over each other. The chief topples backwards down the stairs and falls from Weathertop. He rolls down the ruins and gets impaled on a sharp stone. </p>\n<p>The other four Riders flop around in the mud, clawing at one another to get their footing.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Strider then strikes from the shadows.\" role=\"link\" tabindex=\"0\">Strider then strikes from the shadows.</a></p>",
		'attributes': ["defeatedChief = 1"],
		'passages': {
		},
	},
	'Strider then strikes from the shadows.': {
		'text': "<p>Strider swings his blade in a wide arc, attacking the Riders and knocking them away.</p>\n<p>{if hobbitGroup=1:{if defeatedChief=0:The Riders are lost and confused in the rain, and Strider is fast and nimble against them.}}</p>\n<p>{if hobbitGroup=1:{if defeatedChief=1:As he does so, you recollect the Ring and watch as he manages to decapitate one of the Riders. The absence of the chief gives him more room to get the advantage on them. A second Rider goes down easy under his blade.}}</p>\n<p>{if hobbitGroup=2:He then grabs a flaming branch from Sam&#39;s fire and swipes it at them. The light is too much for their eyes, and he easily sets one ablaze.}</p>\n<p>{if hobbitGroup=3:He then grabs a flaming branch from Sam&#39;s fire and swipes it at them. The light is too much for their eyes, and he easily sets one ablaze. {if merryDead=0:Merry and Pippin grab some torches as well and help stave off their foes.}}</p>\n<p>{if hobbitGroup=4:Pippin awakes to to see the turmoil they&#39;re in. Surrounded by Black Riders and bombed out of his mind, Pippin stands up, grabs a log from the fire and proceeds to clobber the stuffing out of them. &quot;You damned wraiths! You killed Merry! I&#39;ll kill you! I&#39;ll kill all of you!&quot;}</p>\n<p>{if hobbitGroup=4:Sam pulls you aside as Pippin bashes one Rider&#39;s head in with the flaming log. He then grabs its sword and drives it through another.}</p>\n<p>{if hobbitGroup=1:{if defeatedChief=0:Overwhelmed by Strider&#39;s attacks, the chief orders all four Riders to fall back.}}\n{if hobbitGroup=1:{if defeatedChief=1:Overwhelmed by Strider&#39;s attacks, and without their chief, the remaining two Riders flee in terror.}}\n{if hobbitGroup=1:{if defeatedChief=1:{@ridersDefeated=2}}}</p>\n<p>{if hobbitGroup=2:Terrified, and burning alive, the chief order his followers to flee. They run out into the dark to stop, drop and roll.}</p>\n<p>{if hobbitGroup=3:Terrified, and burning alive, the chief order his followers to flee. They run out into the dark to stop, drop and roll.}</p>\n<p>{if hobbitGroup=4:{if defeatedChief=0:Overwhelmed by Pippin&#39;s fury and Strider&#39;s attacks, the chief orders the remaining two Riders to flee. But it&#39;s too late. Strider takes the chief&#39;s head with one swipe, and Pippin chases after the other two and does unspeakable things to them in the dark. Despite their seemingly immortal status, all it took was one vicious (and very drunk) Hobbit to end their reign of terror.}}\n{if hobbitGroup=4:{if defeatedChief=0:{@ridersDefeated=5}}}</p>\n<p>{if hobbitGroup=2:&quot;That&#39;ll show &#39;em,&quot; Sam says.}</p>\n<p>{if hobbitGroup=4:&quot;That was for Merry!&quot; Pippin screams in a drunken stupor.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Strider quickly checks the area for more enemies.\" role=\"link\" tabindex=\"0\">Strider quickly checks the area for more enemies.</a></p>",
		'passages': {
		},
	},
	'Strider quickly checks the area for more enemies.': {
		'text': "<p>{if gaveFakeName=0:<a class=\"squiffy-link link-section\" data-section=\"That's when you hear a high-pitched screech descend from above.\" role=\"link\" tabindex=\"0\">That&#39;s when you hear a high-pitched screech descend from above.</a>}</p>\n<p>{if gaveFakeName=1:<a class=\"squiffy-link link-section\" data-section=\"It's clear.\" role=\"link\" tabindex=\"0\">It&#39;s clear.</a>}</p>",
		'passages': {
		},
	},
	'It\'s clear.': {
		'text': "<p>{if hobbitGroup=1:{if jam=0:&quot;They&#39;ll be back,&quot; Strider says. &quot;We cannot stay here. We must forego rest and <a class=\"squiffy-link link-section\" data-section=\"make a run for Rivendell tonight.\" role=\"link\" tabindex=\"0\">make a run for Rivendell tonight.</a>&quot;}}</p>\n<p>{if hobbitGroup=1:{if jam=1:Gandalf runs up to Weathertop, shouting &quot;I&#39;m here! I&#39;m here! What did I miss?&quot; But Strider&#39;s already done the dirty work. He tells Gandalf to mount a night watch while you and he get some rest. With Gandalf on guard, the Riders do not return, and you wake up refreshed the next morning.}}</p>\n<p>{if hobbitGroup=1:{if jam=1:<a class=\"squiffy-link link-section\" data-section=\"And so you complete your journey to Rivendell.\" role=\"link\" tabindex=\"0\">And so you complete your journey to Rivendell.</a>}}</p>\n<p>{if hobbitGroup=2:{if jam=0:&quot;They won&#39;t return tonight,&quot; Strider says. &quot;Get another campfire going and I&#39;ll keep watch while you rest tonight.&quot; You oblige and Strider stays up the night, watching for more Riders. Having been burned once tonight, they do not return. By morning, you and Sam are refreshed.}}</p>\n<p>{if hobbitGroup=2:{if jam=1:Gandalf runs up to Weathertop, shouting &quot;I&#39;m here! I&#39;m here! What did I miss?&quot; But Strider&#39;s already done the dirty work. He tells Gandalf to mount a night watch while you, he and Sam get some rest. With Gandalf on guard, the Riders do not return, and you wake up refreshed the next morning.}}</p>\n<p>{if hobbitGroup=3:{if jam=0:&quot;They won&#39;t return tonight,&quot; Strider says. &quot;Get another campfire going and I&#39;ll keep watch while you rest.&quot; You oblige and Strider stays up the night, watching for more Riders. Having been burned once tonight, they do not return. By morning, you and the other Hobbits are refreshed.}}</p>\n<p>{if hobbitGroup=3:{if jam=1:Gandalf runs up to Weathertop, shouting &quot;I&#39;m here! I&#39;m here! What did I miss?&quot; But Strider&#39;s already done the dirty work. He tells Gandalf to mount a night watch while you, he and the other Hobbits get some rest. With Gandalf on guard, the Riders do not return, and you wake up refreshed the next morning.}}</p>\n<p>{if hobbitGroup=4:{if jam=0:&quot;They DEFINITELY won&#39;t return tonight,&quot; Strider says. &quot;Get another campfire going and I&#39;ll keep watch while you rest.&quot; You oblige and Strider stays up the night, watching for more Riders. Having been massacred by a drunken Pippin, they do not return. By morning, you are refreshed.}}</p>\n<p>{if hobbitGroup=4:{if jam=1:Gandalf runs up to Weathertop, shouting &quot;I&#39;m here! I&#39;m here! What did I miss?&quot; But Strider and Pippin have already done the dirty work. He tells Gandalf to mount a night watch while you and Pippin get some rest. With Gandalf on guard, the Riders do not return, and you wake up refreshed the next morning.}}</p>\n<p>{if hobbitGroup=2:<a class=\"squiffy-link link-section\" data-section=\"And so you complete your journey to Rivendell.\" role=\"link\" tabindex=\"0\">And so you complete your journey to Rivendell.</a>}\n{if hobbitGroup=3:<a class=\"squiffy-link link-section\" data-section=\"And so you complete your journey to Rivendell.\" role=\"link\" tabindex=\"0\">And so you complete your journey to Rivendell.</a>}\n{if hobbitGroup=4:<a class=\"squiffy-link link-section\" data-section=\"And so you complete your journey to Rivendell.\" role=\"link\" tabindex=\"0\">And so you complete your journey to Rivendell.</a>}</p>",
		'passages': {
		},
	},
	'make a run for Rivendell tonight.': {
		'text': "<p>You{if hobbitGroup=2:, Sam,} and Strider leave Weathertop and hurry into the rain. The path to Rivendell is exposed to the elements, and Strider fears the Black Riders will overtake you once they return with additional men. You&#39;re only hope is to reach the woods.</p>\n<p>But it&#39;s too late.</p>\n<p>The Riders have returned in greater numbers. Their horses swarm around you. Strider fends off their strikes as they ride in close. </p>\n<p>One morgul blade glances off his. The flat end strikes you in the back of the head and everything goes dark. {if gaveFakeName=0:You hear the screech of the winged beast fast approaching. }{if hobbitGroup=2:Sam cries out for you.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue16\" role=\"link\" tabindex=\"0\">You fall into the mud.</a></p>",
		'passages': {
		},
	},
	'_continue16': {
		'text': "<p>Hours pass.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You awaken in a strange bed.\" role=\"link\" tabindex=\"0\">You awaken in a strange bed.</a></p>",
		'passages': {
		},
	},
	'That\'s when you hear a high-pitched screech descend from above.': {
		'text': "<p>{if hobbitGroup&lt;3:{if jam=0:Strider quickly ushers you into hiding as a winged beast soars over Weathertop. It is the WITCH KING, drawn to this place for reasons unknown. You stay quiet until it has passed.}}</p>\n<p>{if hobbitGroup&lt;3:{if jam=0:As the beast disappears into the night. Strider says, &quot;The beast will return soon. We should <a class=\"squiffy-link link-section\" data-section=\"make a run for Rivendell tonight.\" role=\"link\" tabindex=\"0\">make a run for Rivendell tonight.</a>&quot;}}</p>\n<p>{if hobbitGroup=3:{if jam=0:A giant winged beast descends on Weathertop. A fanged, reptilian mouth snaps down around Merry. You watch in horror as the robed figure of the WITCH KING flies off on his winged beast, with Merry&#39;s lifeless corpse in its jaws. Pippin cries out, &quot;Merry! No!&quot;}}\n{if hobbitGroup=3:{if jam=0:{@merryKilledOnWeathertop=1}}}</p>\n<p>{if hobbitGroup=3:{if jam=0:As it flies away, the beast&#39;s tail strikes the towering ruins above you. Before you can process what happened to Merry, loose stones fall from the ruin and you are struck in the head. <a class=\"squiffy-link link-section\" data-section=\"You collapse to the mud and pass out.\" role=\"link\" tabindex=\"0\">You collapse to the mud and pass out.</a>}}</p>\n<p>{if hobbitGroup=4:{if jam=0:A giant winged beast descends on Weathertop. A fanged, reptilian mouth snaps down around Pippin. You watch in horror as the robed figure of the WITCH KING flies off on his winged beast, with Pippin&#39;s lifeless corpse in its jaws.}}\n{if jam=0:{if hobbitGroup=4:{if gaveFakeName=0:{@pippinKilledByWitchKing=1}}}}</p>\n<p>{if hobbitGroup=4:{if jam=0:As it flies away, the beast&#39;s tail strikes the towering ruins above you. Before you can process what happened to Pippin, loose stones fall from the ruin and you are struck in the head. <a class=\"squiffy-link link-section\" data-section=\"You collapse to the mud and pass out.\" role=\"link\" tabindex=\"0\">You collapse to the mud and pass out.</a>}}</p>\n<p>{if jam=1:A giant winged beast descends on Weathertop. A fanged, reptilian mouth comes straight for your party. It is the WITCH KING atop his flying steed, and he has come for your Ring.}</p>\n<p>{if jam=1:The WITCH KING is then deflected by a powerful field of light. Gandalf stands atop the towering ruins, holding out his staff and shining a magical beam of sunlight into the beast&#39;s path. The monster swerves to evade, and the Witch King falls off his mount. He lands on his feet among your ruins and prepares to fight your party with his wretched mace.}</p>\n<p>{if jam=1:&quot;Fools,&quot; he says, &quot;No MAN can defeat me.&quot;}</p>\n<p>{if jam=1:You wonder if <a class=\"squiffy-link link-section\" data-section=\"you should provoke Gandalf to attack again\" role=\"link\" tabindex=\"0\">you should provoke Gandalf to attack again</a> or <a class=\"squiffy-link link-section\" data-section=\"put your faith in Strider's sword\" role=\"link\" tabindex=\"0\">put your faith in Strider&#39;s sword</a>. {if jam=1:{if hasButterknife=1:Or maybe even <a class=\"squiffy-link link-section\" data-section=\"your trusty butterknife\" role=\"link\" tabindex=\"0\">your trusty butterknife</a>.}}}</p>\n<p>{if jam=1:{if learnedTomsSong=1:{if hasButterknife=0:That&#39;s when <a class=\"squiffy-link link-section\" data-section=\"you feel a song coming on.\" role=\"link\" tabindex=\"0\">you feel a song coming on.</a>}}}</p>\n<p>{if jam=1:{if learnedTomsSong=1:{if hasButterknife=1:You vaguely remember something important Tom tried to teach you for emergencies like this, but it&#39;s all a blur now.}}}</p>",
		'passages': {
		},
	},
	'You collapse to the mud and pass out.': {
		'text': "<p>You feel the hours in the darkness pass. Your dreams are scattered and you hear the screams of the Rider&#39;s beast again and again in your head. Soon, the terror passes, and all that remains is a painful headache.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You awaken in a strange bed.\" role=\"link\" tabindex=\"0\">You awaken in a strange bed.</a></p>",
		'passages': {
		},
	},
	'you should provoke Gandalf to attack again': {
		'text': "<p>You tell Gandalf to attack the Witch King again! But seriously this time!</p>\n<p>{if gandalfAngry&gt;3:Gandalf{if gandalfDragsYouFromBree=1:, still miffed that he had to drag you from Bree like a child,} snaps back, &quot;Serious?! I&#39;ll show you serious, Mr. Baggins!&quot;}</p>\n<p>{if gandalfAngry&gt;3:The wizard charges up a massive energy blast and lets it fly at the Witch King. The Witch King is send flying across the Middle-Earth landscape. He crash lands on a farm, landing face-first in a wagon of manure.}</p>\n<p>{if gandalfAngry&gt;3:&quot;Never goad a wizard, boy,&quot; Gandalf tells you. &quot;Or next time, you&#39;ll be better off with the Witch King.&quot;}\n{if gandalfAngry&gt;3:{@inc gandalfAngry}}</p>\n<p>{if gandalfAngry&lt;4:Gandalf charges up another light blast and lets loose on his foe. A blinding beam scares away the Witch King. It retreats into the night.}</p>\n<p>&quot;The Riders won&#39;t return tonight with Gandalf here,&quot; Strider says. &quot;Let&#39;s get some rest and hurry to Rivendell in the morning.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"And so you complete your journey to Rivendell.\" role=\"link\" tabindex=\"0\">And so you complete your journey to Rivendell.</a></p>",
		'attributes': ["gandalfGoadedOnWeathertop = 1"],
		'passages': {
		},
	},
	'And so you complete your journey to Rivendell.': {
		'text': "<p>You are greeted warmly by the elves, and Strider fills them in on the events at Weathertop, telling them of the Riders{if gaveFakeName=0: and the Witch King}. {if ridersDefeated=5:They can&#39;t wrap their heads around the idea of a drunken Hobbit slaughtering the agents of Sauron, but they seem marginally impressed.} The elves send out soldiers to make sure your {if ridersDefeated=5:other }enemies steer clear of Rivendell.</p>\n<p>{if jam=0:You also meet up with Gandalf. He tells you that Saruman has joined forces with Sauron. Gandalf himself was held prisoner at Isengard until some eagles saved him.}</p>\n<p>{if jam=1:{if gaveFakeName=0:&quot;We got lucky out there,&quot; Gandalf says. &quot;The Witch King wouldn&#39;t have arrived unless ONE OF US dropped our guard and revealed secret information to an enemy. We must be more cautious moving forward.&quot;}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gandalf gets to the situation at hand.\" role=\"link\" tabindex=\"0\">Gandalf gets to the situation at hand.</a></p>",
		'passages': {
		},
	},
	'put your faith in Strider\'s sword': {
		'text': "<p>&quot;I got this,&quot; Strider says, as he attacks the Witch King. The two of them spar, but Strider is more nimble and able-footed in the mud. The Witch King is outmatched in this weather and hastily retreats from Weathertop. It&#39;s a very anticlimactic victory.</p>\n<p>&quot;The Riders won&#39;t return tonight,&quot; Strider says. &quot;Let&#39;s get some rest and hurry to Rivendell in the morning.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"And so you complete your journey to Rivendell.\" role=\"link\" tabindex=\"0\">And so you complete your journey to Rivendell.</a></p>",
		'passages': {
		},
	},
	'your trusty butterknife': {
		'text': "<p>You take out your butter knife and say you&#39;ll handle this. Because you are no man... YOU ARE A HOBBIT.</p>\n<p>You rush at the Witch King and plunge the butter knife into his FACE!</p>\n<p>The Witch King chuckles and scoffs, &quot;Semantics.&quot;</p>\n<p>He throws you to the ground and strikes you in the head with his mace. You black out instantly.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You awaken in a strange bed.\" role=\"link\" tabindex=\"0\">You awaken in a strange bed.</a></p>",
		'attributes': ["hasButterknife = 0"],
		'passages': {
		},
	},
	'you feel a song coming on.': {
		'text': "<p>Back when you were young, you remember an elven songtress named Beyonce and her merry band coming to the Shire to put on a show. In this moment, you easily recount the words to a famous song she sang.</p>\n<p>Your hips begin to move and you start singing, to everyone&#39;s surprise, about &#39;single ladies&#39; and where a man should&#39;ve put a &#39;Ring&#39;. Needless to say, the Witch King is stunned.</p>\n<p>Aragorn LOVES this song, and immediately joins in as your back-up dancer. He nails all the moves, confusing the Witch King even further.</p>\n<p>Gandalf rolls his eyes, recognizing Tom Bombadil&#39;s handiwork. Then he bedrudgingly joins your group, mumbling the words and faking the moves, even though he secretly loves this song too.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue17\" role=\"link\" tabindex=\"0\">The Witch King can&#39;t handle this anymore.</a></p>",
		'passages': {
		},
	},
	'_continue17': {
		'text': "<p>He lunges at your dance troupe with his mace, and slips in the mud, falling past you. He slides face-first into an unstable ruin of stones. The stones collapse inward on him.</p>\n<p>The Witch King is crushed under the weight of a giant stone, defeated by the jammin&#39; tunes of Beyonce.</p>\n<p>&quot;I can&#39;t believe that worked,&quot; Gandalf grumbles.</p>\n<p>&quot;I don&#39;t think the others will be coming back,&quot; Strider says, as he wraps up his set, &quot;Let&#39;s get some shut-eye and head to Rivendell.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue18\" role=\"link\" tabindex=\"0\">And so you do.</a></p>",
		'attributes': ["witchKingDead = 1","witchKingDanceOff = 1"],
		'passages': {
		},
	},
	'_continue18': {
		'text': "<p>By morning, you arrive in Rivendell and are greeted warmly by the elves. Strider tells them of your encounter with the Riders last night, and how you used an elven song to defeat the Witch King. Everyone&#39;s excited to meet you and you spend the morning geting a lovely spa treatment with Strider.</p>\n<p>Gandalf spends the morning wandering and wondering about what to do next. He consults with King Elrond and gets back to you.</p>\n<p>He finds you and Strider enjoying a hot spring together. He coughs loudly, prompting you to lift the cucumbers from your eyes. &quot;If you two are finished, there are urgent matters to be taken care of.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gandalf gets to the situation at hand.\" role=\"link\" tabindex=\"0\">Gandalf gets to the situation at hand.</a></p>",
		'passages': {
		},
	},
	'wear the Ring and turn invisible': {
		'text': "<p>Now seems like the right time to wear the Ring. As you slip on the Ring and turn invisible, you&#39;re certain the Black Riders won&#39;t see you at all.</p>\n<p>The five Riders enter the circle of ruins and look directly at you. This is clearly not working. Before you can react, the chief runs up and <a class=\"squiffy-link link-section\" data-section=\"plunges his morgul blade into your shoulder\" role=\"link\" tabindex=\"0\">plunges his morgul blade into your shoulder</a>. A deadly poison seeps into your blood. </p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'plunges his morgul blade into your shoulder': {
		'text': "<p>Your senses dull and your vision fades.</p>\n<p>The last thing you see is Strider attacking the Riders as you slip into darkness. \n{if hobbitGroup=2:{if jam=0:Sam cries out for you.}}{if hobbitGroup=3:{if jam=0:Your friends cry out for you.}}{if hobbitGroup=4:{if jam=0:Sam cries out for you. Pippin drools and rolls over.}}</p>\n<p>{if gaveFakeName=0:{if jam=0:You also hear the screech of that winged beast from earlier. You have a bad feeling things aren&#39;t going well.}}\n{if hobbitGroup=3:{if jam=0:{if gaveFakeName=0:{@merryKilledOnWeathertop=1}}}}\n{if hobbitGroup=3:{if jam=0:{if gaveFakeName=0:{@merryDead=1}}}}\n{if hobbitGroup=4:{if jam=0:{if gaveFakeName=0:{@pippinKilledByWitchKing=1}}}}\n{if hobbitGroup=4:{if jam=0:{if gaveFakeName=0:{@pippinDead=1}}}}</p>\n<p>{if gaveFakeName=0:{if jam=1:You also hear the screech of that winged beast from earlier, and Gandalf shouting. You feel powerful magic in the air as you slip away.}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue19\" role=\"link\" tabindex=\"0\">You faint from the blade&#39;s poison.</a></p>",
		'passages': {
		},
	},
	'_continue19': {
		'text': "<p>Lost in the turmoil, you flop into the mud and let the Morgul poison whisk you into darkness.</p>\n<p>You see visions of New Zealand. Your Uncle Bilbo sits on his front porch smoking his pipeweed and waving to you as you drift through this waking nightmare. He is played by that guy from &quot;The Office&quot;. The BBC version, not the the American one. You&#39;re not especially fond of the American version, but you&#39;re wary to admit that among friends. </p>\n<p>You momentarily wonder if you fell out of a Tolkien story and belly-flopped into a Terry Pratchett one.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue20\" role=\"link\" tabindex=\"0\">Hours pass and the darkness subsides.</a></p>",
		'passages': {
		},
	},
	'_continue20': {
		'text': "<p>Words like New Zealand, BBC and Terry Pratchett seem like mindless drivel in your mind as you slip back into the reality of Middle-Earth.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You awaken in a strange bed.\" role=\"link\" tabindex=\"0\">You awaken in a strange bed.</a></p>",
		'passages': {
		},
	},
	'You awaken in a strange bed.': {
		'text': "<p>You are laying in the golden morning sun of a lovely Elven bedroom. Outside, you see waterfalls and garishly ornamental architecture. You are now in the Elven city of Rivendell.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue21\" role=\"link\" tabindex=\"0\">Gandalf sits across from your bed.</a></p>",
		'passages': {
		},
	},
	'_continue21': {
		'text': "<p>&quot;You almost died,&quot; he says. &quot;Fortunately, a troop of elves happened by and were quick to deliver you here and save your life.{if gaveFakeName=0:{if jam=1: We}{if jam=0: You} were set upon by the Witch King, but {if jam=1:I}{if jam=0:Strider} drove him off.{if pippinKilledByWitchKing=1: Unfortunately, your friend Pippin was not so lucky. The Witch King mistook him for you, and his beast made off with him in its jaws. It&#39;s too late for him now, I&#39;m afraid.}{if merryKilledOnWeathertop=1: Unfortunately, your friend Merry was not so lucky. The Witch King mistook him for you, and his beast made off with him in its jaws. It&#39;s too late for him now, I&#39;m afraid.}{if hobbitGroup&gt;1: Be thankful your friend Sam has made it here safely.}}&quot;</p>\n<p>{if jam=0:You eagerly want to know where Gandalf&#39;s been.}</p>\n<p>{if jam=0:&quot;I&#39;ve been to see Saruman,&quot; Gandalf explains. &quot;But he has allied himself with Sauron. He tried to trap me on his roof, but I called in my last favour from the eagles to escape.&quot;}</p>\n<p>{if hobbitGroup&gt;1:Soon after, Sam joins you, alive and well. {if hobbitGroup=3:{if merryKilledOnWeathertop=0:Merry and Pippin are also here, having succesfully escaped Weathertop. You have successfully scored a perfect four out of four hobbits on this quest.}{if merryKilledOnWeathertop=1:Pippin is also here, but he looks unwell, still disturbed by Merry&#39;s death. He glares at you with contempt and silently leaves the room.}}}</p>\n<p>{if hobbitGroup=4:{if pippinKilledByWitchKing=0:Pippin is also here, albeight with a nasty hangover. He glares at you with contempt, still upset over Merry&#39;s death. His eyes are drawn toward the Ring. You nervously hide it from his sight. Pippin scowls and silently leaves the room.}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gandalf gets to the situation at hand.\" role=\"link\" tabindex=\"0\">Gandalf gets to the situation at hand.</a></p>",
		'passages': {
		},
	},
	'Gandalf gets to the situation at hand.': {
		'text': "<p>{if merryDead=1:{if pippinDead=0:{@pippinTriesToTakeTheRing=1}}}\n{if hobbitGroup=1:{@fellowship=1}}\n{if hobbitGroup=2:{@fellowship=2}}\n{if hobbitGroup=3:{if merryDead=0:{@fellowship=3}}}\n{if hobbitGroup=3:{if merryDead=1:{@fellowship=4}}}\n{if hobbitGroup=4:{if pippinDead=0:{@fellowship=4}}}\n{if hobbitGroup=4:{if pippinDead=1:{@fellowship=2}}}</p>\n<p>&quot;Now we must <a class=\"squiffy-link link-section\" data-section=\"attend the secret Council of Elrond\" role=\"link\" tabindex=\"0\">attend the secret Council of Elrond</a> to determine the fate of that Ring you carry.{if gandalfDragsYouFromBree=1: And please don&#39;t <a class=\"squiffy-link link-section\" data-section=\"put on another juvenile display\" role=\"link\" tabindex=\"0\">put on another juvenile display</a> like you did at Bree.}&quot;</p>",
		'passages': {
		},
	},
	'put on another juvenile display': {
		'text': "<p>You don&#39;t want to go to the Council of Elrond, but attendance is mandatory and Gandalf has to drag you there. You grab onto every railing and door frame you pass, screaming as you go. Gandalf is forced to yank you free every ten seconds, pulling at your heels while you kick at his face. </p>\n<p>It takes you twenty minutes to travel six houses over. You finally <a class=\"squiffy-link link-section\" data-section=\"attend the secret Council of Elrond\" role=\"link\" tabindex=\"0\">attend the secret Council of Elrond</a>.</p>",
		'attributes': ["gandalfAngry+=1","gandalfDraggedYouToCouncil = 1"],
		'passages': {
		},
	},
	'attend the secret Council of Elrond': {
		'text': "<p>{if gandalfDraggedYouToCouncil=1:Your arrival at the Council is loud and feisty. Many in attendance help strap you to a chair so they can begin.}</p>\n<p>Elrond, the Elf King is here, along with a company of elves you don&#39;t know. Strider is here, but he now introduces himself as &#39;Aragorn&#39;, and that becomes his name from now on. You also see a dwarf and a human you don&#39;t know. There are snacks on a nearby table, so you help yourself and listen.</p>\n<p>{if jam=1:Gandalf asks if Saruman is coming to the Council. Elrond replies, &quot;We&#39;ve learned the wizard Saruman has joined forces with Sauron. Perhaps it is best you didn&#39;t go to see him; he might have locked you in his basement or something. We&#39;ll have to keep the Ring away from him as well.&quot;}</p>\n<p>The dwarf, Gimli, says &quot;<a class=\"squiffy-link link-section\" data-section=\"We must destroy the Ring!\" role=\"link\" tabindex=\"0\">We must destroy the Ring!</a>&quot;</p>\n<p>The human, Boromir, says &quot;No! My father&#39;s army battles Sauron&#39;s army at the Black Gate! Give me the Ring and I will <a class=\"squiffy-link link-section\" data-section=\"use its power to defeat Mordor\" role=\"link\" tabindex=\"0\">use its power to defeat Mordor</a>!&quot; </p>\n<p>&quot;What do you think, Ring-bearer?&quot; Elrond asks. {if witchKingDanceOff=1:&quot;Your dancing skills did best the Witch King after all. Perhaps you know something we don&#39;t?&quot;}</p>\n<p>{if learnedTomsSong=1:You <a class=\"squiffy-link link-passage\" data-passage=\"wonder if Tom Bombadil might be able to help\" role=\"link\" tabindex=\"0\">wonder if Tom Bombadil might be able to help</a>.}</p>",
		'passages': {
			'wonder if Tom Bombadil might be able to help': {
				'text': "<p>Before you can suggest giving the Ring to Tom Bombadil, Gandalf immediately pipes up,{if witchKingDanceOff=1: remembering your dance-off on Weathertop,} &quot;No, no, no! Let&#39;s not bring Tom into this. He&#39;s... he&#39;s too silly.&quot;</p>",
			},
		},
	},
	'use its power to defeat Mordor': {
		'text': "<p>You offer the Ring to Boromir.</p>\n<p>Gandalf slaps your hand. &quot;No! The Ring&#39;s power must not be used. We&#39;re doing that thing Gimli said. <a class=\"squiffy-link link-section\" data-section=\"We must destroy the Ring!\" role=\"link\" tabindex=\"0\">We must destroy the Ring!</a>&quot;</p>\n<p>Boromir glares at Gandalf, but regards you warmly. He&#39;ll remember this moment.</p>",
		'attributes': ["gandalfAngry+=1","boromirRemembers+=1","gandalfOfferedRingToBoromir = 1"],
		'passages': {
		},
	},
	'We must destroy the Ring!': {
		'text': "<p>Destroying it sounds reasonable to you.</p>\n<p>Almost everyone is onboard, until Elrond explains, &quot;The only way to destroy the Ring is to throw it into the fires of Mt. Doom. To match Sauron&#39;s agents, we will assemble a Fellowship of Nine to accompany the Ring into Mordor, behind enemy lines. Which Nine shall partake in this quest?&quot;</p>\n<p>Your friend Gandalf accepts this mission, as do Aragorn, Gimli, and an elf named Legolas. Boromir also agrees to accompany it, but asks if everyone can just <a class=\"squiffy-link link-passage\" data-passage=\"use the Eagles to fly into Mordor instead of walk\" role=\"link\" tabindex=\"0\">use the Eagles to fly into Mordor instead of walk</a>.</p>\n<p>Gandalf glances at you, wondering if <a class=\"squiffy-link link-section\" data-section=\"you will continue carrying the Ring\" role=\"link\" tabindex=\"0\">you will continue carrying the Ring</a>, or if <a class=\"squiffy-link link-section\" data-section=\"it will fall to someone else\" role=\"link\" tabindex=\"0\">it will fall to someone else</a>.</p>",
		'passages': {
			'use the Eagles to fly into Mordor instead of walk': {
				'text': "<p>While you contemplate the Ring, Gandalf explains to Boromir that the Eagles are an ancient, intelligent race who can be easily swayed by the Ring&#39;s power. The Eagles would sooner dump the Fellowship in Mt. Doom and keep the Ring for themselves. Boromir decides against being dumped in a volcano and shuts up about the Eagles.</p>",
			},
		},
	},
	'it will fall to someone else': {
		'text': "<p>You toss the Ring to the ground and tell everyone you&#39;re out. They begin to argue among themselves over who will carry the Ring.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue22\" role=\"link\" tabindex=\"0\">&quot;I will carry the Ring!&quot; a voice shouts from the bushes.</a></p>",
		'passages': {
		},
	},
	'_continue22': {
		'text': "<p>{if fellowship=4:Pippin emerges from the bushes. In his eyes are sadness and a lingering darkness. &quot;Sauron&#39;s monsters killed my best friend, all because Frodo here insisted we come along on this stupid adventure. Well, if he won&#39;t see it through, I will. I will take the Ring.&quot;}</p>\n<p>{if fellowship=4:&quot;Absolutely not!&quot; Gandalf stands. &quot;There is bloodlust and vengeance in your eyes, Peregrin Took. {if ridersDefeated=5:Your wrath upon the Black Riders at Weathertop is proof enough that the Ring has you marked. }The Ring would overtake you easily. Begone from this Council.&quot;}</p>\n<p>{if fellowship=4:Pippin creeps out of the Council, backwards into the bushes.}</p>\n<p>{if fellowship=4:&quot;How about I carry it, then?&quot; another voice asks.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Your Uncle Bilbo is here!\" role=\"link\" tabindex=\"0\">Your Uncle Bilbo is here!</a></p>",
		'passages': {
		},
	},
	'Your Uncle Bilbo is here!': {
		'text': "<p>He has been staying with the elves and greets you as he marches up the steps towards the Council. He eyes the Ring at your feet and picks it back up.</p>\n<p>&quot;I took this Ring from the creature Gollum,&quot; he says. &quot;It&#39;s my fault the Dark Lord is after it. It&#39;s only right that I rid Middle-Earth of its evil.&quot;</p>\n<p>&quot;Very well,&quot; Gandalf says{if gandalfDraggedYouToCouncil=1:, relieved that he won&#39;t be dragging you to Mordor}, &quot;Welcome to the Fellowship, Bilbo.&quot;</p>\n<p>A handful of elves agree to fill out the rest of Bilbo&#39;s roster.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You retire to your room.\" role=\"link\" tabindex=\"0\">You retire to your room.</a></p>",
		'passages': {
		},
	},
	'you will continue carrying the Ring': {
		'text': "<p>You&#39;re in. You will take the Ring to Mordor.</p>\n<p>{if fellowship=1:Elrond nods, &quot;And are there three others <a class=\"squiffy-link link-section\" data-section=\"who will join?\" role=\"link\" tabindex=\"0\">who will join?</a>&quot;}</p>\n<p>{if fellowship&gt;1:&quot;Me too!&quot; Sam exclaims as he jumps out of the bushes and runs to your side.}</p>\n<p>{if fellowship&gt;1:{@samJoins=1}}</p>\n<p>{if fellowship=3:&quot;And we&#39;ll go on this certainly lethal mission too!&quot; says Merry as he and Pippin emerge from the same bushes.}</p>\n<p>{if fellowship=3:Elrond agrees that all four hobbits can go. The rest of the Fellowship seems uneasy about escorting four inexperienced halflings behind enemy lines, but they suck it up.}</p>\n<p>{if fellowship=3:{@merryJoins=1}}</p>\n<p>{if fellowship=3:<a class=\"squiffy-link link-section\" data-section=\"Elrond nods approvingly.\" role=\"link\" tabindex=\"0\">Elrond nods approvingly.</a>}</p>\n<p>{if fellowship=2:Elrond nods, &quot;And are there two others <a class=\"squiffy-link link-section\" data-section=\"who will join?\" role=\"link\" tabindex=\"0\">who will join?</a>&quot;}</p>\n<p>{if fellowship=4:Elrond nods, &quot;And are there two others <a class=\"squiffy-link link-section\" data-section=\"who will join?\" role=\"link\" tabindex=\"0\">who will join?</a>&quot;}</p>\n<p>{if fellowship=4:You spy Pippin also hiding in the bushes, but he does not come forward. Instead, he slinks away and leaves the Council.}</p>",
		'passages': {
		},
	},
	'who will join?': {
		'text': "<p>{if fellowship=1:{@arwenJoins=1}}\n{if fellowship=1:{@beornJoins=1}}\n{if fellowship=2:{@arwenJoins=1}}\n{if fellowship=4:{@arwenJoins=1}}</p>\n<p>{if arwenJoins=1:Two elves step forward from the others, one female, the other male. They almost look like identical twins at a glance. The woman speaks, &quot;I am Arwen, daughter of Elrond. This is my interchangeable comrade, Glorfindel, but you can call him Glorfy. We would be honoured to join this Fellowship.&quot;}</p>\n<p>{if arwenJoins=1:Legolas hops off his stool and high-fives both of them. Now that Arwen and Glorfy are coming, he&#39;s really excited for this trip.}</p>\n<p>{if beornJoins=1:&quot;We have room for one more,&quot; says Gandalf.}</p>\n<p>{if beornJoins=1:A huge bear-sized man emerges from a nearby hut. He is adorned in bear skins, and has a very bear-like stench and demeanor.}</p>\n<p>{if beornJoins=1:&quot;I TURN INTO BEEEAAARRR!!!&quot; he screams.}</p>\n<p>{if beornJoins=1:Gandalf&#39;s eyes light up and he squeals out a laugh. &quot;Ohhh, snap! Beorn is here??? Guys! You guys! This is gonna be the best Fellowship ever!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Elrond nods approvingly.\" role=\"link\" tabindex=\"0\">Elrond nods approvingly.</a></p>",
		'passages': {
		},
	},
	'Elrond nods approvingly.': {
		'text': "<p>&quot;Then it will be Frodo, Aragorn, Gimli, Legolas, Boromir,{if fellowship&gt;1: Sam,}{if fellowship=3: Merry, Pippin,}{if fellowship&lt;3: Arwen, Glorfy,}{if fellowship=4: Arwen, Glorfy,}{if fellowship=1: Beorn,} and Gandalf. And you shall be... the FELLOWSHIP OF THE RING.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You return to your quarters to prepare for your journey.\" role=\"link\" tabindex=\"0\">You return to your quarters to prepare for your journey.</a></p>",
		'passages': {
		},
	},
	'You retire to your room.': {
		'text': "<p>Later that night, Uncle Bilbo comes to your room. He is adorned in a mythril vest and carries his trusty sword, Sting.</p>\n<p>&quot;How does it look?&quot; he asks, showing off his gear. &quot;I think I look ready for one more adventure.&quot;</p>\n<p>You wish your uncle good luck on his journey and he heads back to his own room.</p>\n<p>{if fellowship=4:As he leaves, you see Pippin move past the window. You call out to him, but he ignores you. Merry&#39;s death is still weighing heavily on him.}</p>\n<p>{if fellowship=4:<a class=\"squiffy-link link-section\" data-section=\"But it weighs more heavily than it seems.\" role=\"link\" tabindex=\"0\">But it weighs more heavily than it seems.</a>}</p>\n<p>{if fellowship&lt;4:The next day, <a class=\"squiffy-link link-section\" data-section=\"Bilbo leaves on his journey.\" role=\"link\" tabindex=\"0\">Bilbo leaves on his journey.</a>}</p>",
		'passages': {
		},
	},
	'But it weighs more heavily than it seems.': {
		'text': "<p>You hear a scream in the night from Uncle Bilbo&#39;s room.</p>\n<p>You race through the Rivendell streets and arrive to find your uncle dead on the floor, stabbed through the neck.</p>\n<p>You hear another shout nearby. The elven archers of the nightwatch let fly their arrows and a body falls in the streets. The whole town awakens to see who it is.</p>\n<p>You see Pippin bleeding to death, barely breathing. On the ground, inches from his fingers, is a bloody dagger. Clutched in his other hand is the Ring. He weakly speaks, &quot;I had to take it, Frodo... I had to destroy it myself... it killed... it killed my Merry...&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue23\" role=\"link\" tabindex=\"0\">Pippin passes away.</a></p>",
		'attributes': ["pippinDead = 1","bilboDead = 1","pippinKilledBilbo = 1","fellowship = 2"],
		'passages': {
		},
	},
	'_continue23': {
		'text': "<p>Gandalf approaches and speaks, &quot;The Ring&#39;s treachery has claimed more innocent lives, Frodo. It has been whispering to Pippin since his friend&#39;s death, using his grief as a vessel to escape its fate. And now your dear uncle has become a victim of its wrath.&quot;</p>\n<p>&quot;It must not <a class=\"squiffy-link link-section\" data-section=\"stay in Rivendell\" role=\"link\" tabindex=\"0\">stay in Rivendell</a>,&quot; Aragorn says. &quot;lest its evil taint the wills of its people. What say you, Frodo?&quot;</p>\n<p>The Ring calls to you, begging you to <a class=\"squiffy-link link-section\" data-section=\"claim it from Pippin's hand\" role=\"link\" tabindex=\"0\">claim it from Pippin&#39;s hand</a>. </p>",
		'passages': {
		},
	},
	'stay in Rivendell': {
		'text': "<p>You decide the Ring is still not yours to take. You walk away to tend to your uncle&#39;s body. Everyone is too afraid to touch the Ring and they leave it on the road next to Pippin&#39;s body.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue24\" role=\"link\" tabindex=\"0\">The days pass.</a></p>",
		'passages': {
		},
	},
	'_continue24': {
		'text': "<p>You and Sam pass your time in Rivendell while everyone else argues over who will carry the Ring. You give Uncle Bilbo a lovely funeral under a waterfall and even tend to Pippin&#39;s funeral, understanding that he was poisoned by the Ring&#39;s influence.</p>\n<p>Gandalf occasionally stops in to check on you, sometimes asking if you&#39;re interested in going for a walk. You politely decline. You&#39;re done with walking.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The elves start getting restless.\" role=\"link\" tabindex=\"0\">The elves start getting restless.</a></p>",
		'passages': {
		},
	},
	'The elves start getting restless.': {
		'text': "<p>The first fight over the Ring erupts over the nightwatch. Two elves are shot with arrows and sent to the infirmary. The in-fighting soon becomes more frequent. Elrond orders the Ring taken to his quarters for safe-keeping.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue25\" role=\"link\" tabindex=\"0\">One night, you are rudely awakened.</a></p>",
		'passages': {
		},
	},
	'_continue25': {
		'text': "<p>&quot;Frodo, we must go! Wake up!&quot;</p>\n<p>Gandalf is shaking you. Aragorn, Gimli, and Boromir are in your room as well. Legolas runs in, carrying the Ring with a pair of metal tongs. He thrusts it into your hand shouting, &quot;They&#39;ve killed Elrond and they&#39;re going to come for you too! We must leave Rivendell immediately!&quot;</p>\n<p>You ask if the Black Riders have arrived. Gandalf says, &quot;No, it&#39;s as we feared. The elves want to take the Ring for themselves. They&#39;ve rallied a mob; Rivendell is no longer safe.&quot;</p>\n<p>You barely have time to grab your belongings. You take the Ring and follow the Fellowship out of Rivendell. {if fellowship&gt;1:Sam quickly joins you, shouting &quot;You&#39;re not going anywhere without your Sam!&quot;}</p>\n<p>{if fellowship=3:Merry and Pippin have no idea what&#39;s going on, but they happen to see you running and follow after.}</p>\n<p>{if fellowship&lt;3:Two nearly identical elves, a female and male, also join you. They are Arwen, daughter of Elrond, and Glorfindel, but you can call him Glorfy. Legolas vouches for the interchangeable duo, and they become part of your Fellowship.}\n{if fellowship&lt;3:{@arwenJoins=1}}</p>\n<p>{if fellowship=1:You&#39;re lastly joined by large hairy man, named Beorn, who claims he can turn into a bear. Gandalf vouches for him, claiming Beorn will make the Fellowship awesome.}\n{if fellowship=1:{@beornJoins=1}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue26\" role=\"link\" tabindex=\"0\">You escape Rivendell with elves at your heels.</a></p>",
		'attributes': ["elrondDead = 1"],
		'passages': {
		},
	},
	'_continue26': {
		'text': "<p>Fortunately, Legolas is able to use his keen elf senses to help you evade your pursuers. The Fellowship heads east towards the mountains.</p>\n<p>&quot;I&#39;m sorry, Frodo,&quot; Gandalf says. &quot;I know you wanted to <a class=\"squiffy-link link-passage\" data-passage=\"stay out of this\" role=\"link\" tabindex=\"0\">stay out of this</a>, but the Ring has taken too much just to find its way back to you. It seems you&#39;ll never be free until it&#39;s destroyed.&quot;</p>\n<p>You sigh. Despite your efforts, it looks like you have no choice in this matter.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship travels towards the Misty Mountains.\" role=\"link\" tabindex=\"0\">The Fellowship travels towards the Misty Mountains.</a></p>",
		'passages': {
			'stay out of this': {
				'text': "<p>On the way, you try many times to slip away from the Fellowship and avoid any further adventure, but your many companions always take chase and drag you back. It appears your options are limited in such a large group, so you follow along for now.</p>",
			},
		},
	},
	'claim it from Pippin\'s hand': {
		'text': "<p>You take the Ring into your own hand. Too much blood has been spilled in this town over your fear to carry it before. Now you understand that the Ring must stay with you. You volunteer to take it to Mordor.</p>\n<p>&quot;Not without me!&quot; Sam declares, standing by your side.</p>\n<p>Two other interchangeable elves agree to join you. They are Arwen, daughter of Elrond, and Glorfindel (aka Glorfy). They and Sam round out the Fellowship to nine.</p>\n<p>The Fellowship agrees with your choice. They tend to Bilbo and Pippin&#39;s bodies, give them appropriate funerals, and then prepare your things for the trip ahead. Gandalf ensures that Bilbo&#39;s sword and mythril vest go with you.</p>\n<p>By morning, you set out on your quest.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship travels towards the Misty Mountains.\" role=\"link\" tabindex=\"0\">The Fellowship travels towards the Misty Mountains.</a></p>",
		'attributes': ["hasMythrilVest = 1","hasSwordSting = 1"],
		'passages': {
		},
	},
	'Bilbo leaves on his journey.': {
		'text': "<p>You wish him and the Fellowship farewell and settle into your quarters in Rivendell, wondering how to make your journey back to the Shire. {if fellowship&gt;1:Sam is eager to hit the road.} {if fellowship=3: Merry and Pippin rather enjoy the elves and would like to stay longer.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue27\" role=\"link\" tabindex=\"0\">Tragedy strikes, and the Fellowship returns to Rivendell.</a></p>",
		'passages': {
		},
	},
	'_continue27': {
		'text': "<p>&quot;There&#39;s been an accident,&quot; Gandalf tells you. &quot;We were crossing a rather steep hill, and Bilbo slipped and fell. He rolled down the hill for several meters, hit a rock, and then continued rolling to the bottom. And then he rolled a little further and hit a tree. By the time we reached him, he was dead. I&#39;m sorry, Frodo.&quot;</p>\n<p>You are distraught over your dear uncle&#39;s death. A service is held for Bilbo immediately and people begin to question who will carry the Ring now.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue28\" role=\"link\" tabindex=\"0\">Time passes.</a></p>",
		'attributes': ["bilboDead = 1"],
		'passages': {
		},
	},
	'_continue28': {
		'text': "<p>Gandalf is concerned about the Ring&#39;s presence in Rivendell. He worries its evil will infect the elves. He wishes someone he trusts would volunteer to <a class=\"squiffy-link link-section\" data-section=\"carry the Ring for him\" role=\"link\" tabindex=\"0\">carry the Ring for him</a>. You think about it, but you&#39;d also like to <a class=\"squiffy-link link-section\" data-section=\"stay comfortable here in Rivendell.\" role=\"link\" tabindex=\"0\">stay comfortable here in Rivendell.</a></p>",
		'passages': {
		},
	},
	'stay comfortable here in Rivendell.': {
		'text': "<p>So you do.</p>\n<p>As you prepare for your journey home, the Fellowship often squabbles among themselves. Boromir insists on carrying the Ring, and Gandalf repeatedly denies him the task. Gandalf insists only someone with a pure will should carry it to Mordor. You&#39;re glad to have not gotten involved.</p>\n<p>More time passes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The elves start getting restless.\" role=\"link\" tabindex=\"0\">The elves start getting restless.</a></p>",
		'passages': {
		},
	},
	'carry the Ring for him': {
		'text': "<p>You tell the Fellowship you&#39;ll do it. You&#39;ll carry the Ring in Bilbo&#39;s place as you should have in the first place.</p>\n<p>Gandalf pretends he&#39;s concerned for your well-being, but he&#39;s secretly glad you volunteered.</p>\n<p>{if fellowship&gt;1:Sam pipes up, &quot;If you&#39;re going, I&#39;ll go too!&quot;}</p>\n<p>{if fellowship=3:Merry and Pippin also run to your side. It looks like you&#39;re going to Mordor with a full team of Hobbits.}</p>\n<p>{if fellowship&lt;3:Two nearly identical elves, a female and male, also agree to accompany you. They are Arwen, daughter of Elrond, and Glorfindel, but you can call him Glorfy. Legolas vouches for the interchangeable pair, and they become part of your Fellowship.}\n{if fellowship&lt;3:{@arwenJoins=1}}</p>\n<p>{if fellowship=1:You&#39;re lastly joined by large hairy man, named Beorn, who claims he can turn into a bear. Gandalf vouches for him, claiming Beorn will make the Fellowship awesome.}\n{if fellowship=1:{@beornJoins=1}}</p>\n<p>You and the rest of the Fellowship leave Rivendell at the soonest convenience.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship travels towards the Misty Mountains.\" role=\"link\" tabindex=\"0\">The Fellowship travels towards the Misty Mountains.</a></p>",
		'passages': {
		},
	},
	'You return to your quarters to prepare for your journey.': {
		'text': "<p>While in your quarters, you are greeted with a visit from your Uncle Bilbo. Uncle Bilbo has retired here in Rivendell and wants to impart a gift on you for your journey.</p>\n<p>&quot;This is my sword, Sting, and my indestructible mythril vest,&quot; he says. &quot;Would you <a class=\"squiffy-link link-section\" data-section=\"take them on your trip?\" role=\"link\" tabindex=\"0\">take them on your trip?</a> It&#39;s <a class=\"squiffy-link link-section\" data-section=\"okay if you say no\" role=\"link\" tabindex=\"0\">okay if you say no</a>.&quot;</p>",
		'passages': {
		},
	},
	'okay if you say no': {
		'text': "<p>You politely decline. {if hasButterknife=1:You show Bilbo your butterknife and assure him you&#39;ll be fine.}</p>\n<p>Bilbo looks disappointed. &quot;All right, well... good luck, Frodo.&quot;</p>\n<p>He hugs you goodbye and takes both the sword and vest with him.</p>\n<p>{if fellowship&lt;4:The next day, you and the Fellowship begin your journey.}</p>\n<p>{if fellowship&lt;4:<a class=\"squiffy-link link-section\" data-section=\"The Fellowship travels towards the Misty Mountains.\" role=\"link\" tabindex=\"0\">The Fellowship travels towards the Misty Mountains.</a>}</p>\n<p>{if fellowship=4:Later that night, <a class=\"squiffy-link link-section\" data-section=\"you receive an unexpected visit.\" role=\"link\" tabindex=\"0\">you receive an unexpected visit.</a>}</p>",
		'passages': {
		},
	},
	'take them on your trip?': {
		'text': "<p>You tell him you are honoured, slipping it on. It&#39;s a perfect fit.</p>\n<p>Bilbo is very happy and hugs you good-bye.</p>\n<p>{if fellowship&lt;4:The next day, you and the Fellowship begin your journey.}</p>\n<p>{if fellowship&lt;4:<a class=\"squiffy-link link-section\" data-section=\"The Fellowship travels towards the Misty Mountains.\" role=\"link\" tabindex=\"0\">The Fellowship travels towards the Misty Mountains.</a>}</p>\n<p>{if fellowship=4:Later that night, <a class=\"squiffy-link link-section\" data-section=\"you receive an unexpected visit.\" role=\"link\" tabindex=\"0\">you receive an unexpected visit.</a>}</p>",
		'attributes': ["hasMythrilVest = 1","hasSwordSting = 1"],
		'passages': {
		},
	},
	'you receive an unexpected visit.': {
		'text': "<p>You awaken in bed with a hand over your mouth. Pippin leers down at you, a knife in his hand, and madness in his eyes.{if ridersDefeated=5: The same madness you saw when he slaughtered the Black Riders.}</p>\n<p>&quot;Merry&#39;s death isn&#39;t yours to avenge,&quot; he says. &quot;It&#39;s your fault he&#39;s dead; the Ring shouldn&#39;t be yours to carry. I&#39;ll be the one who destroys it!&quot;</p>\n<p>He strikes at you and you scuffle with him, desperately trying to wrestle the knife out of his hand.</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"try to reason with him\" role=\"link\" tabindex=\"0\">try to reason with him</a>{if hasButterknife=1:, but <a class=\"squiffy-link link-section\" data-section=\"your butterknife beckons\" role=\"link\" tabindex=\"0\">your butterknife beckons</a>}.</p>",
		'passages': {
		},
	},
	'try to reason with him': {
		'text': "<p>There is no reason within Pippin. The Ring has possessed him and he&#39;ll stop at nothing to take it from you.</p>\n<p>Someone overhears your scuffle. A member of the nightwatch fires an arrow through your window and pierces Pippin in the back. Your dead friend falls to the floor dead.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gandalf and Sam run into your room.\" role=\"link\" tabindex=\"0\">Gandalf and Sam run into your room.</a></p>",
		'attributes': ["pippinDead=1"],
		'passages': {
		},
	},
	'your butterknife beckons': {
		'text': "<p>You drive your butterknife into Pippin. He chokes and dies, rolling over onto the floor.</p>\n<p>The nightwatch saw Pippin attack you and hurries to alert someone.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Gandalf and Sam run into your room.\" role=\"link\" tabindex=\"0\">Gandalf and Sam run into your room.</a></p>",
		'attributes': ["pippinDead=1","hasButterknife = 0"],
		'passages': {
		},
	},
	'Gandalf and Sam run into your room.': {
		'text': "<p>Gandalf solemnly speaks, &quot;The Ring has claimed another, I see.&quot;</p>\n<p>Sam sheds a tear. &quot;He wasn&#39;t himself after Weathertop. But we&#39;ll destroy the Ring together, Frodo. For Merry and Pippin.&quot;</p>\n<p>The morning comes. Bilbo sees to Pippin&#39;s affairs, and the Fellowship departs.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship travels towards the Misty Mountains.\" role=\"link\" tabindex=\"0\">The Fellowship travels towards the Misty Mountains.</a></p>",
		'attributes': ["fellowship = 2"],
		'passages': {
		},
	},
	'The Fellowship travels towards the Misty Mountains.': {
		'text': "<p>The nine of you leave Rivendell and begin your long walk across Middle-Earth.</p>\n<p>Gandalf leads the pack, with Aragorn, Gimli, and Legolas taking up the front and scouting out the quickest passages through Middle-Earth&#39;s forests and rolling hills. </p>\n<p>Boromir trudges on behind, quietly debating if he should betray the group and take the Ring for himself.</p>\n<p>{if witchKingDanceOff=1:As you walk, you feel compelled to sing more songs. You start up a little ditty about walking 500 miles when Gandalf immediately stops you.}</p>\n<p>{if witchKingDanceOff=1:&quot;There&#39;ll be no more singing from here on,&quot; Gandalf says. &quot;We don&#39;t need Bombadil&#39;s tomfoolery making a joke of this Fellowship. Besides, I had enough of dwarves singing on my last excursion.&quot;}</p>\n<p>{if witchKingDanceOff=1:Everyone&#39;s very disappointed, but respects Gandalf&#39;s request for peace and quiet. For now.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue29\" role=\"link\" tabindex=\"0\">Your journey continues.</a></p>",
		'passages': {
		},
	},
	'_continue29': {
		'text': "<p>{if fellowship&gt;1:Sam&#39;s presence in the Fellowship is quite welcome as he&#39;s brought an entire kitchen&#39;s worth of cooking supplies and makes delicious meals for the group at every opportunity.}</p>\n<p>{if fellowship=3:Merry and Pippin&#39;s presence are less welcome. They constantly complain about the lack of second breakfasts, and need to stop ten times more often for bathroom breaks. Gandalf mumbles to himself that they&#39;ll be the death of him.}</p>\n<p>{if fellowship&lt;3:Arwen and Glomfindel take up the rear and help shoot Saruman&#39;s spy-crows out of the sky. Thanks to them, you spend less time in hiding and make excellent time on the road.}</p>\n<p>{if beornJoins=1:Beorn stomps around like the giant bear-man he is, and says &quot;RAAAWWWRRR!!!&quot; a lot. Gandalf absolutely adores him.}</p>\n<p>Aragorn wants to know how you&#39;re feeling. &quot;Do you have a <a class=\"squiffy-link link-section\" data-section=\"good\" role=\"link\" tabindex=\"0\">good</a> or <a class=\"squiffy-link link-section\" data-section=\"bad\" role=\"link\" tabindex=\"0\">bad</a> feeling about this Fellowship?&quot;</p>",
		'passages': {
		},
	},
	'good': {
		'text': "<p>You tell him you have a good feeling about this Fellowship.</p>\n<p>Aragorn will remember that.</p>\n<p>Weeks pass, and <a class=\"squiffy-link link-section\" data-section=\"you soon arrive at the Misty Mountains\" role=\"link\" tabindex=\"0\">you soon arrive at the Misty Mountains</a>.</p>",
		'attributes': ["aragornRemembers = 1"],
		'passages': {
		},
	},
	'bad': {
		'text': "<p>You tell him you have a bad feeling about this Fellowship.</p>\n<p>Aragorn will remember that.</p>\n<p>Weeks pass, and <a class=\"squiffy-link link-section\" data-section=\"you soon arrive at the Misty Mountains\" role=\"link\" tabindex=\"0\">you soon arrive at the Misty Mountains</a>.</p>",
		'attributes': ["aragornRemembers = 0"],
		'passages': {
		},
	},
	'you soon arrive at the Misty Mountains': {
		'text': "<p>The Fellowship ventures up through the Pass of Mt. Caradhras. It is unforgivingly cold and a blizzard soon slows your group to a crawl. {if fellowship=3:Legolas hurries}{if fellowship&lt;3:The elves hurry} over the snow, light as feathers, only to find worse weather ahead. There is a nasty voice on the wind, as if the wizard Saruman is conjuring this storm himself.</p>\n<p>&quot;Let&#39;s go under the mountain!&quot; Gimli suggests. &quot;If we travel through the mines of Moria, my cousin Balin will give us a warm welcome!&quot;</p>\n<p>Gandalf knows everyone in Moria has already been eaten by a Balrog, but doesn&#39;t feel like telling Gimli. &quot;How about we let the Ring-Bearer decide? What&#39;ll it be, Frodo? Shall we brave the <a class=\"squiffy-link link-section\" data-section=\"cold of Caradhras\" role=\"link\" tabindex=\"0\">cold of Caradhras</a>, or the <a class=\"squiffy-link link-section\" data-section=\"darkness of Moria\" role=\"link\" tabindex=\"0\">darkness of Moria</a>?&quot;</p>",
		'passages': {
		},
	},
	'cold of Caradhras': {
		'text': "<p>You decide that since you&#39;ve already climbed halfway up a mountain, you might as well keep going. Everyone begrudgingly continues through the deepening snow.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue30\" role=\"link\" tabindex=\"0\">You continue into the mountains.</a></p>",
		'passages': {
		},
	},
	'_continue30': {
		'text': "<p>Within the day, everyone hates your choice, and you wish you brought warmer boots. {if fellowship=3:Merry and Pippin try licking their swords for fun and get their tongues stuck.}</p>\n<p>Saruman&#39;s storm grows ever more colder and fierce. Snow slides off the peaks above, and random murders of crows swarm your party.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue31\" role=\"link\" tabindex=\"0\">&quot;In here!&quot; Gandalf shouts, ushering the team into a cave.</a></p>",
		'passages': {
		},
	},
	'_continue31': {
		'text': "<p>Aragorn gets a fire going and you all try to warm up. {if fellowship=3:Merry and Pippin&#39;s tongues slowly dethaw from their weapons.}</p>\n<p>{if fellowship=1:Gandalf and Beorn cuddle by the fireplace. Beorn squeezes you into his smelly bear-skin coat.}</p>\n<p>{if fellowship&lt;3:The elves stand guard by the entrance and continue shooting birds like the psychopaths they are.}</p>\n<p>{if fellowship&gt;1:You fear you made the wrong choice, but Sam assures you the Fellowship will make it through.}</p>\n<p>Gandalf speaks, &quot;If we are to conquer Caradhras, we must defend ourselves against Saruman&#39;s magic. I can spare enough power to <a class=\"squiffy-link link-section\" data-section=\"prepare a spell against the cold\" role=\"link\" tabindex=\"0\">prepare a spell against the cold</a>, or I can use it to <a class=\"squiffy-link link-section\" data-section=\"hide us from Saruman's sight\" role=\"link\" tabindex=\"0\">hide us from Saruman&#39;s sight</a>.&quot;</p>",
		'passages': {
		},
	},
	'prepare a spell against the cold': {
		'text': "<p>You don&#39;t care about Saruman&#39;s magic, as long as you can get out of here with all your toes intact. Everyone inclines to agree. Gandalf meditates over his staff, muttering an incantation for an hour until you feel a faint glow over your body.</p>\n<p>&quot;This light will protect against the cold for now,&quot; Gandalf says. &quot;Let us cover as much ground as possible.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You leave the cave and continue into the mountains.\" role=\"link\" tabindex=\"0\">You leave the cave and continue into the mountains.</a></p>",
		'attributes': ["spellAgainstCold = 1"],
		'passages': {
		},
	},
	'hide us from Saruman\'s sight': {
		'text': "<p>You&#39;d prefer to handle the storm without an evil wizard homing in on you. The rest of the Fellowship agrees. Gandalf meditates over his staff, muttering an enchantment for an hour. He appears to be struggling as he speaks, as if Saruman is trying to mutter louder.</p>\n<p>Finally, Gandalf says, &quot;I&#39;ve diverted Saruman&#39;s gaze. We should move now before he finds us again.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You leave the cave and continue into the mountains.\" role=\"link\" tabindex=\"0\">You leave the cave and continue into the mountains.</a></p>",
		'attributes': ["spellAgainstSaruman = 1"],
		'passages': {
		},
	},
	'You leave the cave and continue into the mountains.': {
		'text': "<p>{if spellAgainstCold=1: The cold barely bothers you as the Fellowship hurries through the wintery pass. However, Saruman&#39;s birds are more hostile than ever. Legolas is able to keep them at bay, but they still manage to slow you down with every fly-by.}</p>\n<p>{if spellAgainstSaruman=1: The cold is unbearable as you venture into the mountains, and you feel significantly drained as you hurry. The saving grace is that you no longer run into Saruman&#39;s spies and are easily able to cover more ground.}</p>\n<p>{if spellAgainstCold=1:Regardless, you manage to stay standing and keep up the pace with the rest of the Fellowship.}</p>\n<p>{if spellAgainstSaruman=1: Unfortunately, most of that ground is covered in ice, and you&#39;re quickly turning into a Frodo popsicle.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue32\" role=\"link\" tabindex=\"0\">Gandalf deeply regrets everything.</a></p>",
		'passages': {
		},
	},
	'_continue32': {
		'text': "<p>&quot;I shouldn&#39;t have persuaded you to come,&quot; Gandalf says. &quot;I shouldn&#39;t have sent you to Bree or taken you to Rivendell. If only I were stronger, I could&#39;ve carried the Ring myself.{if bilboDead=1: Maybe I... I could&#39;ve spared Bilbo and your friends.}&quot;</p>\n<p>You want to <a class=\"squiffy-link link-section\" data-section=\"give Gandalf words of encouragement\" role=\"link\" tabindex=\"0\">give Gandalf words of encouragement</a>. {if gandalfDraggedYouToCouncil=1: Or maybe <a class=\"squiffy-link link-section\" data-section=\"words of resentment\" role=\"link\" tabindex=\"0\">words of resentment</a> since you&#39;ve been so good at making him miserable lately.}</p>",
		'passages': {
		},
	},
	'give Gandalf words of encouragement': {
		'text': "<p>You tell Gandalf he&#39;s an okay dude. You remind him that bad things happen, and the most important thing is to keep moving forward. You also tell him he has a cool beard and an awesome hat. {if bilboDead=1:You also forgive him for all the deaths so far. He seems touched by that.}</p>\n<p>&quot;Thank you, Frodo,&quot; he says. &quot;Surely, we will succeed if our Fellowship holds true.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Legolas spots something.\" role=\"link\" tabindex=\"0\">Legolas spots something.</a></p>",
		'passages': {
		},
	},
	'words of resentment': {
		'text': "<p>You tell Gandalf you didn&#39;t want to come and you blame him for everything bad that&#39;s happened so far. You also comment on his smell and ridiculous attire. Gandalf suddenly seems less regretful and more ruthless; which is what the Fellowship needs on this mountain. {if bilboDead=1:You also twist the dagger on Bilbo&#39;s death by reminding Gandalf that Bilbo initially didn&#39;t want to leave the Shire either.}</p>\n<p>&quot;Thanks a LOT, Frodo,&quot; Gandalf grumbles, plotting his slow revenge against your worthless butt.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Legolas spots something.\" role=\"link\" tabindex=\"0\">Legolas spots something.</a></p>",
		'attributes': ["gandalfAngry+=1","gandalfDissedOnMountain = 1"],
		'passages': {
		},
	},
	'Legolas spots something.': {
		'text': "<p>&quot;Ice giants!&quot; he tells you, motioning for everyone to stay quiet.</p>\n<p>Up ahead on the pass are seven troll-sized men covered in frost and carrying spears. They haven&#39;t spotted you yet. {if fellowship=1:Beorn seems eager to wrestle them.}</p>\n<p>&quot;We&#39;ll find another way around,&quot; Gandalf says. &quot;We cannot risk an encounter.&quot;</p>\n<p>&quot;We can go this way!&quot; Gimli hops off the cliff to a lower ledge. He plants his axe in the stone wall and scouts a path across the wall beneath the giants.</p>\n<p>&quot;Take lead, Gimli, we&#39;ll follow,&quot; says Aragorn as he hops down with you. He uses a knife to steady himself as the Fellowship rock-climbs across the sheer wall. You hold onto him tightly. {if fellowship&gt;1:Sam rides with Gimli. }{if fellowship=3:Merry and Pippin ride with Boromir. }{if fellowship=1:Everyone else hangs onto Beorn.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue33\" role=\"link\" tabindex=\"0\">You&#39;re all doing well for a period of time.</a></p>",
		'passages': {
		},
	},
	'_continue33': {
		'text': "<p>As you pass by the giants, you hear them chattering. They&#39;re amusing themselves, trying to solve a riddle about thirty white horses on a red hill. </p>\n<p>&quot;The answer is &#39;Teeth&#39;,&quot; Aragorn whispers. You already knew that.</p>\n<p>You&#39;re almost past the giants and ready to climb back up.</p>\n<p>{if spellAgainstCold=1:That&#39;s when you hear the crowing of Saruman&#39;s birds. A murder of crows spots you on the ledge and screeches loudly, loud enough to get the giants&#39; attention.}</p>\n<p>{if spellAgainstSaruman=1:That&#39;s when you finally give to the cold. You slip from Aragorn&#39;s grasp. He reaches down to catch you and drops his knife. It loudly clatters down the rock face.}</p>\n<p>Three giants approach the cliff. They look down and see nine people hanging off the cliffs below. One of them wonders if this is the answer to the riddle.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue34\" role=\"link\" tabindex=\"0\">Legolas is quick to act.</a></p>",
		'passages': {
		},
	},
	'_continue34': {
		'text': "<p>Digging his toes into a crevice, he frees his hands and leans back, holding himself up with abdominal strength alone. He notches three arrows and fires them directly at the giants&#39; heads. All three arrows strike their targets square in the forehead, but only one giant is killed. The dead giant falls off the cliff and lands in the snow below. The other two just look irritated with arrows in their faces.</p>\n<p>One swings a massive warhammer overhead and strikes the cliff. The other calls for back-up. The Fellowship loses their grip on the stone and slide down the mountainside.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue35\" role=\"link\" tabindex=\"0\">You fall a great distance and land in a deep patch of soft snow.</a></p>",
		'passages': {
		},
	},
	'_continue35': {
		'text': "<p>The ice giants storm after you, sliding down the rocks with ease. You find yourself cornered in a tight chasm. Even more giants emerge from the walls and begin to surround you.</p>\n<p>{if spellAgainstCold=1:Saruman&#39;s birds swirl overhead. The dark wizard&#39;s power is fueling the giants&#39; rage. {if hasSwordSting=1:You draw your sword and prepare to fight.}}</p>\n<p>{if spellAgainstSaruman=1:You try to take a stand, but the cold has sapped almost all of your strength. {if hasSwordSting=1:You don&#39;t even have the power to draw your sword.}}</p>\n<p>&quot;Stay back!&quot; Gandalf shouts as he raises his staff, its light glowing. It seems like he&#39;s preparing a very powerful spell. &quot;Or I&#39;ll see to it personally you face the mountain&#39;s wrath!&quot;</p>\n<p>The giants hesitate as your comrades{if fellowship=3:, even the hobbits,} prepare to fight back. {if fellowship=1:Beorn is especially intimidating.}</p>\n<p>{if spellAgainstCold=1:The dark magic inside your Ring feels agitated by Saruman&#39;s presence. It compels you to <a class=\"squiffy-link link-section\" data-section=\"strike first\" role=\"link\" tabindex=\"0\">strike first</a>, but it might be wiser to <a class=\"squiffy-link link-section\" data-section=\"let Gandalf use his magic\" role=\"link\" tabindex=\"0\">let Gandalf use his magic</a> for now.}</p>\n<p>{if spellAgainstSaruman=1:Despite your frozen stature, you still have a clear head and spot Boromir&#39;s horn hanging off the belt on his waist. You could <a class=\"squiffy-link link-section\" data-section=\"let Gandalf use his magic\" role=\"link\" tabindex=\"0\">let Gandalf use his magic</a>, but you can also <a class=\"squiffy-link link-section\" data-section=\"blow Boromir's horn\" role=\"link\" tabindex=\"0\">blow Boromir&#39;s horn</a> and make some magic of your own.}</p>",
		'passages': {
		},
	},
	'strike first': {
		'text': "<p>You run forward and attack the giants. They swat you back to your starting position. You lay stunned in the snow.</p>\n<p>Maybe you should <a class=\"squiffy-link link-section\" data-section=\"let Gandalf use his magic\" role=\"link\" tabindex=\"0\">let Gandalf use his magic</a> after all.</p>",
		'passages': {
		},
	},
	'let Gandalf use his magic': {
		'text': "<p>You decide to let Gandalf do his thing. The storm intensifies.</p>\n<p>&quot;So you like riddles?&quot; Gandalf asks the giants. &quot;What devours all things, grinds hard stones to meal; ruins towns, and beats high mountain down?&quot;</p>\n<p>One giant snorts, &quot;That one&#39;s easy. The answer is &#39;time&#39;.&quot;</p>\n<p>&quot;No,&quot; Gandalf says, &quot;It&#39;s ME.&quot;</p>\n<p>He strikes the staff into the snow. The entire mountain shakes. The giants look up behind them to see the peak of Caradhas collapse.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"An avalanche is heading your way.\" role=\"link\" tabindex=\"0\">An avalanche is heading your way.</a></p>",
		'attributes': ["gandalfMakesAvalanche = 1"],
		'passages': {
		},
	},
	'blow Boromir\'s horn': {
		'text': "<p>You snatch Boromir&#39;s horn from his belt and give it a loud blow, catching everyone off guard, including Gandalf. The horn echoes through the mountain.</p>\n<p>Then everyone hears a low rumbling from above. Even the giants turn and look behind them to see the peak of Caradhas collapse.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"An avalanche is heading your way.\" role=\"link\" tabindex=\"0\">An avalanche is heading your way.</a></p>",
		'passages': {
		},
	},
	'An avalanche is heading your way.': {
		'text': "<p>Legolas finds the giant he killed and shouts &quot;Hop on!&quot;</p>\n<p>Everyone jumps on the giant&#39;s corpse as the avalanche comes down on you. The other giants flee as well.</p>\n<p>The snow strikes and you&#39;re hurtled down the slope. The whole Fellowship rides the avalanche on the back of a dead giant.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue36\" role=\"link\" tabindex=\"0\">It&#39;s a wild and crazy ride.</a></p>",
		'passages': {
		},
	},
	'_continue36': {
		'text': "<p>You, Gandalf, Boromir and Aragorn stay secure on the giant, desperately trying to balance as it sways throughs the drift, bouncing off rocks as it falls. {if fellowship=2:Sam hangs onto the giant&#39;s leg for dear life. }{if fellowship=3:Sam, Merry and Pippin hang onto the giant&#39;s legs for dear life. } {if fellowship=1:Beorn&#39;s massive frame slips off the corpse and gets lost in the snow.}</p>\n<p>Gimli falls off the giant and tumbles hilariously into the avalanche. Legolas races after him, prancing over the rushing snow as if he were running on solid ground. {if fellowship&lt;3:Arwen and Glorfy cover him, firing arrows at any giants surfacing from the snow.} Legolas grabs onto Gimli and then hops onto the body of another giant unfortunate enough to get caught in the falling snow. Gimli slays the giant with an axe to his head and Legolas surfs the body back down towards the Fellowship.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue37\" role=\"link\" tabindex=\"0\">You find yourself heading towards a cliff.</a></p>",
		'passages': {
		},
	},
	'_continue37': {
		'text': "<p>&quot;Boromir, help me with this!&quot; Aragorn shouts as you pass near a stone wall. He jams his sword into the stone. You and Gandalf hold on tight to him and Boromir as the giant&#39;s corpse falls off the cliff. {if fellowship=3:The avalanche rushes past you, but you manage to grab onto Sam, Merry and Pippin as well.}{if fellowship=2:The avalanche rushes past you, but you manage to grab onto Sam as well.}</p>\n<p>{if fellowship&lt;3:Boromir loses his grip, but Arwen and Glorfy grab onto him.}</p>\n<p>Then Aragorn loses his grip. Legolas and Gimli slide in at the last second to grab him. Now the whole Fellowship dangles precariously over the cliff like a chain of monkeys.</p>\n<p>{if fellowship=1:Then a giant bear emerges from the avalanche! Using his incredible size, Beorn blocks you from the oncoming snow, giving everyone a chance to climb up.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue38\" role=\"link\" tabindex=\"0\">The avalanche&#39;s fury begins to cease.</a></p>",
		'passages': {
		},
	},
	'_continue38': {
		'text': "<p>{if fellowship=1:With Beorn&#39;s assistance, everyone gets to safety. The ice giants no longer pursue you.}</p>\n<p>{if fellowship=2:Arwen and Glorfy pull everyone up and get you to safety. The ice giants no longer pursue you.}</p>\n<p>{if fellowship&lt;3:From here, <a class=\"squiffy-link link-section\" data-section=\"you find safe passage down the mountain.\" role=\"link\" tabindex=\"0\">you find safe passage down the mountain.</a>}</p>\n<p>{if fellowship=3:&quot;We&#39;re slipping!&quot; Merry and Pippin shout as they cling to Sam&#39;s fingers. Sam begs them to hold on.}</p>\n<p>{if fellowship=3:{if jam=0:<a class=\"squiffy-link link-section\" data-section=\"But it's futile.\" role=\"link\" tabindex=\"0\">But it&#39;s futile.</a>}}</p>\n<p>{if fellowship=3:{if jam=1:<a class=\"squiffy-link link-section\" data-section=\"They slip from Sam's grasp.\" role=\"link\" tabindex=\"0\">They slip from Sam&#39;s grasp.</a>}}</p>",
		'passages': {
		},
	},
	'But it\'s futile.': {
		'text': "<p>Merry and Pippin fall from Caradhras. They disappear into the storm below.</p>\n<p>You call out to them, but it&#39;s fruitless. Your friends are gone, and the Fellowship is down to seven.</p>\n<p>The rest of you manage to climb up against the avalanche and get to safety. The ice giants no longer pursue you.</p>\n<p>From here, <a class=\"squiffy-link link-section\" data-section=\"you find safe passage down the mountain.\" role=\"link\" tabindex=\"0\">you find safe passage down the mountain.</a></p>",
		'attributes': ["merryDead = 1","pippinDead = 1","merryPippinFellFromMountain = 1"],
		'passages': {
		},
	},
	'They slip from Sam\'s grasp.': {
		'text': "<p>Merry and Pippin disappear into the storm below. </p>\n<p>You call out to them.</p>\n<p>And they reply.</p>\n<p>&quot;THE EAGLES ARE HERE!&quot; Pippins shouts triumphantly.</p>\n<p>A dozen giant eagles emerge from the storm, one carrying Merry and Pippin on its back. One by one, the Fellowship drops onto the passing eagles who fly them to safety.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The eagles take you to the bottom of the mountain.\" role=\"link\" tabindex=\"0\">The eagles take you to the bottom of the mountain.</a></p>",
		'attributes': ["eaglesComing = 1"],
		'passages': {
		},
	},
	'you find safe passage down the mountain.': {
		'text': "<p>{if merryPippinFellFromMountain=0:You&#39;re all in good spirits after climbing down, especially since you lost no one on this run. {if gandalfMakesAvalanche=0:Gandalf fortunately has enough magic on hand to warm you all up.}}</p>\n<p>{if merryPippinFellFromMountain=1:The Fellowship is saddened by the loss of Merry and Pippin, now that they were just starting to like them. Aragorn even considers starting a &#39;Second Breakfast Club&#39; just to honour their memory.}</p>\n<p>{if merryPippinFellFromMountain=0:&quot;Caradhras is behind us,&quot;}{if merryPippinFellFromMountain=1:&quot;We&#39;ll mourn for them later,&quot;} Gandalf says. &quot;We must carry on into the forest of Lothlorien now.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue your journey to the forest of Lothlorien.\" role=\"link\" tabindex=\"0\">You continue your journey to the forest of Lothlorien.</a></p>",
		'passages': {
		},
	},
	'The eagles take you to the bottom of the mountain.': {
		'text': "<p>You dismount from the eagles and thank them. {if gandalfMakesAvalanche=0:Gandalf fortunately has enough magic on hand to warm you all up.} The wizard speaks to their leader, who nods and flies away.</p>\n<p>As the eagles leave, you see one with a scarred eye glance down towards you. Its glare lingers long enough to concern you.</p>\n<p>&quot;Can&#39;t we ride them to Mordor?&quot; Gimli asks.</p>\n<p>Gandalf says, &quot;That was my last favour with the Great Eagles, though I wish it were under better circumstances. It was too risky bringing them near the Ring and I will not ask for their help again.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue your journey to the forest of Lothlorien.\" role=\"link\" tabindex=\"0\">You continue your journey to the forest of Lothlorien.</a></p>",
		'attributes': ["eaglesAreComing = 1"],
		'passages': {
		},
	},
	'darkness of Moria': {
		'text': "<p>You&#39;re tired of travelling uphill, so you decide you want off this mountain. Gimli can barely contain his excitement.</p>\n<p>&quot;Very well,&quot; Gandalf sighs, knowing full-well there&#39;s a Balrog down in Moria. &quot;Let&#39;s go back.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue39\" role=\"link\" tabindex=\"0\">The Fellowship returns down the mountain.</a></p>",
		'passages': {
		},
	},
	'_continue39': {
		'text': "<p>You travel to the west gate of the mountain and arrive at the Doors of Durin, in front of a quiet lake. Elven lettering is written around the frame of the magically sealed door.</p>\n<p>Gandalf translates: &quot;Speak <a class=\"squiffy-link link-section\" data-section=\"friend\" role=\"link\" tabindex=\"0\">friend</a> and enter&quot;, but does not know the password for unlocking the doors.</p>\n<p>The others suggest various magical passwords, such as <a class=\"squiffy-link link-passage\" data-passage=\"Open Sesame\" role=\"link\" tabindex=\"0\">Open Sesame</a>, <a class=\"squiffy-link link-passage\" data-passage=\"Alizebu\" role=\"link\" tabindex=\"0\">Alizebu</a>, <a class=\"squiffy-link link-passage\" data-passage=\"Alohomora\" role=\"link\" tabindex=\"0\">Alohomora</a>, <a class=\"squiffy-link link-passage\" data-passage=\"Goo Goo Ga Choo\" role=\"link\" tabindex=\"0\">Goo Goo Ga Choo</a>, <a class=\"squiffy-link link-passage\" data-passage=\"Gandalf's mother's maiden name\" role=\"link\" tabindex=\"0\">Gandalf&#39;s mother&#39;s maiden name</a>, and <a class=\"squiffy-link link-passage\" data-passage=\"the number on your luggage\" role=\"link\" tabindex=\"0\">the number on your luggage</a>. Eventually, they all look at you, hoping you&#39;ll come up with something.</p>",
		'passages': {
			'Open Sesame': {
				'text': "<p>You try the default password for most magic doors, but someone clearly changed it after installing.</p>",
			},
			'Alizebu': {
				'text': "<p>You try some random noises you once heard a talking dog make. This door does not understand the reference, nor care to.</p>",
			},
			'Alohomora': {
				'text': "<p>You speak some wizard-sounding nonsense. Gandalf rolls his eyes.</p>",
			},
			'Goo Goo Ga Choo': {
				'text': "<p>You quote some lyrics. Gimli reminds you that you are not a walrus.</p>",
			},
			'Gandalf\'s mother\'s maiden name': {
				'text': "<p>You speak her name, but it doesn&#39;t work. Gandalf makes a mental note to change his bank security question.</p>",
			},
			'the number on your luggage': {
				'text': "<p>&#39;1-2-3-4-5&#39; is definitely not the door&#39;s password.</p>",
			},
		},
	},
	'friend': {
		'text': "<p>You suggest the elvish word for &#39;friend&#39;. Gandalf translates and the door pops open.</p>\n<p>&quot;Don&#39;t <a class=\"squiffy-link link-passage\" data-passage=\"look so smug\" role=\"link\" tabindex=\"0\">look so smug</a>&quot;, Gandalf says. &quot;<a class=\"squiffy-link link-section\" data-section=\"Let's go inside.\" role=\"link\" tabindex=\"0\">Let&#39;s go inside.</a>&quot;</p>",
		'passages': {
			'look so smug': {
				'text': "<p>You totally look so smug.</p>",
				'attributes': ["gandalfAngry+=1"],
			},
		},
	},
	'Let\'s go inside.': {
		'text': "<p>The Fellowship enters the darkness of Moria. Gandalf&#39;s staff glows brightly, illuminating the corridor ahead. Littered across the ground are the bones and mangled corpses of the dwarves Gimly was looking forward to meeting.</p>\n<p>Gimli&#39;s jaw drops in horror. &quot;I changed my mind. Let&#39;s go back.&quot;</p>\n<p>As the Fellowship turns around, a giant squid emerges from the lake and slams the door shut on them. {if fellowship=1:Beorn pushes back against the doors with all his strength, but the squid is stronger.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue40\" role=\"link\" tabindex=\"0\">You now have no choice but to face the dark of Moria.</a></p>",
		'passages': {
		},
	},
	'_continue40': {
		'text': "<p>Once you get used to the corpses, it&#39;s not so bad. You {if fellowship&gt;1:and Sam }admire the dwarven architecture throughout this underground city. Aragorn points out many interesting rocks along the way, including a lovely room full of gypsum ore (he thinks this is the high-point of your trip so far.) Gimli&#39;s still mortified.</p>\n<p>{if fellowship=3:Merry and Pippin try to keep spirits up with a game of &#39;I Spy&#39;. Everything is pitch-black, so nobody wins.}</p>\n<p>You eventually arrive at a room with three doors, and are certain Gandalf will ask you to pick one. Instead, he sets up camp so you can rest. Legolas{if fellowship=3: patrols}{if fellowship&lt;3:, Arwen, and Glorfy patrol} the area as elves are wont to do.</p>\n<p>Later that night, you and Gandalf are enjoying some pipe-weed. Gandalf wants to know if <a class=\"squiffy-link link-section\" data-section=\"you regret carrying the Ring\" role=\"link\" tabindex=\"0\">you regret carrying the Ring</a>, or if <a class=\"squiffy-link link-section\" data-section=\"you're super-excited to be here\" role=\"link\" tabindex=\"0\">you&#39;re super-excited to be here</a>. {if gandalfAngry&gt;4:Or if you&#39;re going to <a class=\"squiffy-link link-section\" data-section=\"continue being an annoying brat.\" role=\"link\" tabindex=\"0\">continue being an annoying brat.</a>}</p>",
		'passages': {
		},
	},
	'you regret carrying the Ring': {
		'text': "<p>You tell Gandalf you are sad all this had to happen, and wish you never even heard of this Ring.</p>\n<p>&quot;We all face such regrets,&quot; Gandalf tries to sound wise. &quot;But please remember that bad stuff happens anyway, so just try to finish what you start and see what comes of it. The worst that can happen is more regret, providing you survive.&quot;</p>\n<p>You are confused by Gandalf&#39;s wisdom.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"He then discovers the way forward.\" role=\"link\" tabindex=\"0\">He then discovers the way forward.</a></p>",
		'passages': {
		},
	},
	'you\'re super-excited to be here': {
		'text': "<p>You tell Gandalf you&#39;re so glad to be on this trip together. You&#39;ve always wanted to go on a quest like Uncle Bilbo, and now it&#39;s only a matter of time before you&#39;re also exchanging riddles, riding barrels, and meeting dragons. You&#39;re so glad the Ring came to you.</p>\n<p>Gandalf raises his eyebrows and admires your optimism. &quot;Such a big heart for a little Hobbit. Keep that strength, Frodo, for we will need that light before this journey is through.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"He then discovers the way forward.\" role=\"link\" tabindex=\"0\">He then discovers the way forward.</a></p>",
		'passages': {
		},
	},
	'continue being an annoying brat.': {
		'text': "<p>You tell Gandalf he&#39;s to blame for all this. He&#39;s a blight upon you, you uncle, and the Shire and you wish he just stayed in Wizard Land or whatever stupid place wizards come from.</p>\n<p>Gandalf inhales deeply from his pipe and wonders if the Ring isn&#39;t the only thing that needs throwing in a volcano.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"He then discovers the way forward.\" role=\"link\" tabindex=\"0\">He then discovers the way forward.</a></p>",
		'attributes': ["gandalfComplainedInMoria = 1","gandalfAngry+=1"],
		'passages': {
		},
	},
	'He then discovers the way forward.': {
		'text': "<p>Gandalf chooses the left tunnel because the other two lead uphill and everyone&#39;s sick of stairs. Even deep within the Earth, down is better.</p>\n<p>The Fellowship soon arrives at a large room with a tomb inside. It is the resting place of Gimli&#39;s cousin, Balin. Gimli is super-sad about it and stops to grieve. Gandalf decides now is a good time to tell Gimli a Balrog ate his whole family, causing Gimli to cry more.</p>\n<p>{if fellowship&lt;3:While you&#39;re waiting, you see a small well nearby. A bucket sits on the edge. You briefly consider <a class=\"squiffy-link link-section\" data-section=\"pushing it in for fun\" role=\"link\" tabindex=\"0\">pushing it in for fun</a>, but maybe <a class=\"squiffy-link link-section\" data-section=\"you should just carry on\" role=\"link\" tabindex=\"0\">you should just carry on</a>.}</p>\n<p>{if fellowship=3:A loud racket explodes and echoes from a nearby well. Your friend Pippin has accidentally pushed a bucket into Moria&#39;s depths and awakened every living thing in the mountain.}</p>\n<p>{if fellowship=3:<a class=\"squiffy-link link-section\" data-section=\"Gandalf loses his mind.\" role=\"link\" tabindex=\"0\">Gandalf loses his mind.</a>}</p>",
		'passages': {
		},
	},
	'pushing it in for fun': {
		'text': "<p>The bucket loudly clatters and echoes throughout the entire mine. Everyone looks at you with quiet, morbid terror.</p>\n<p>You shrug.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You hear war drums fast approaching.\" role=\"link\" tabindex=\"0\">You hear war drums fast approaching.</a></p>",
		'attributes': ["gandalfAngry+=1","gandalfAngry+=1","gandalfPushedBucket = 1"],
		'passages': {
		},
	},
	'you should just carry on': {
		'text': "<p>The Fellowship carries on through the mine. It is a short uneventful trip, in which no one dies. You actually get through in ten minutes, which is nice.</p>\n<p>&quot;I guess Moria wasn&#39;t the worst choice,&quot; Gandalf says. </p>\n<p>Gimli is still crying.</p>\n<p>You cross the Bridge of Khazad-Dum and emerge from the caves into daylight. Legolas tells you that you&#39;ll need to cross the forests of Lothlorien now.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue your journey to the forest of Lothlorien.\" role=\"link\" tabindex=\"0\">You continue your journey to the forest of Lothlorien.</a></p>",
		'passages': {
		},
	},
	'Gandalf loses his mind.': {
		'text': "<p>After scolding Pippin and telling him to wait in the corner, Gandalf readies himself for battle. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You hear war drums fast approaching.\" role=\"link\" tabindex=\"0\">You hear war drums fast approaching.</a></p>",
		'passages': {
		},
	},
	'You hear war drums fast approaching.': {
		'text': "<p>The ground shakes as hordes of goblins awake from their slumber and storm towards the tomb.</p>\n<p>Aragon, Legolas{if fellowship&lt;3:, Arwen, Glorfy}, and Gimli ready their weapons.{if fellowship&gt;1: Sam stands beside you, prepared to fight{if fellowship=3:, as are Merry and Pippin}.} Boromir barricades the door and spies the enemy forces incoming. </p>\n<p>They have a cave troll. {if fellowship=1:Beorn is so ready for this. His clothes fall apart as he transforms into a giant bear.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue41\" role=\"link\" tabindex=\"0\">The cave troll breaks down the door.</a></p>",
		'passages': {
		},
	},
	'_continue41': {
		'text': "<p>The next few minutes are violent and erratic as the Fellowship cuts down every enemy that enters Balin&#39;s tomb. Aragorn, Boromir and Gimli easily cut down the ground forces, while Legolas rides the cave troll around like a crazed rodeo bull.  {if fellowship&lt;3:Arwen and Glorfy perform fancy gymkata techniques on Balin&#39;s tomb, kicking their foes away.} {if fellowship=1:Beorn&#39;s just wreckin&#39; everyone else.} </p>\n<p>As the rest of the Fellowship defend you, you hear the Ring whispering to <a class=\"squiffy-link link-section\" data-section=\"once again put it on\" role=\"link\" tabindex=\"0\">once again put it on</a>. You <a class=\"squiffy-link link-section\" data-section=\"try to resist the temptation.\" role=\"link\" tabindex=\"0\">try to resist the temptation.</a></p>",
		'passages': {
		},
	},
	'once again put it on': {
		'text': "<p>You slip the Ring on and become invisible long enough to flee to a safe corner of the room, effectively leaving your friends behind. The Ring is more than delighted to keep you company.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The battle of Balin's tomb continues.\" role=\"link\" tabindex=\"0\">The battle of Balin&#39;s tomb continues.</a></p>",
		'attributes': ["precious+=1","precious+=1"],
		'passages': {
		},
	},
	'try to resist the temptation.': {
		'text': "<p>Instead, you take up a weapon and help your friends fight against the enemy goblins. None see you coming, as you&#39;re small enough to come in under their field of vision. It&#39;s a glorious battle none in the Shire would believe.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue42\" role=\"link\" tabindex=\"0\">And then the cave troll stabs you with a spear.</a></p>",
		'passages': {
		},
	},
	'_continue42': {
		'text': "<p>{if hasMythrilVest=0:You heavily regret not dressing to kill. Without any armour, the spear skewers you easily and you are pinned against a wall, bleeding to death. Not even the Ring can help you now}</p>\n<p>{if hasMythrilVest=0:{@stabbedBySpear=1}}</p>\n<p>{if hasMythrilVest=1:Fortunately, your uncle&#39;s mythril vest deflects the blade. You&#39;re knocked down and bruised, but ultimately unharmed.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The battle of Balin's tomb continues.\" role=\"link\" tabindex=\"0\">The battle of Balin&#39;s tomb continues.</a></p>",
		'passages': {
		},
	},
	'The battle of Balin\'s tomb continues.': {
		'text': "<p>The Fellowship works together to bring down the troll, using every weapon on hand. The troll eventually collapses, looking like a giant pincushion. {if fellowship=1:Beorn delivers the finisher by picking up Balin&#39;s tomb and pile-driving it onto the troll&#39;s head. He turns back into a human and puts back on whatever clothes he has left.}</p>\n<p>{if stabbedBySpear=1:Aragorn quickly wraps your wound and throws you over his shoulder. He&#39;s determined to get you out of here alive, but <a class=\"squiffy-link link-section\" data-section=\"you feel yourself fading fast.\" role=\"link\" tabindex=\"0\">you feel yourself fading fast.</a>}</p>\n<p>{if stabbedBySpear=0:You gather your weapons, exchange high-fives, and hurry out of the room before reinforcements arrive.}</p>\n<p>{if stabbedBySpear=0:Soon, <a class=\"squiffy-link link-section\" data-section=\"the whole mine is after you.\" role=\"link\" tabindex=\"0\">the whole mine is after you.</a>}</p>",
		'passages': {
		},
	},
	'you feel yourself fading fast.': {
		'text': "<p>A lot seems to be happening around you.</p>\n<p>&quot;Goblins, Frodo! Goblins everywhere!&quot;</p>\n<p>&quot;Now there&#39;s a Balrog! Look at the Balrog, Frodo! You&#39;re missing it!&quot;</p>\n<p>&quot;Check out this awesome bridge, Frodo!&quot;</p>\n<p>&quot;Gandalf! Nooooooo!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue43\" role=\"link\" tabindex=\"0\">You awaken outside the mines.</a></p>",
		'attributes': ["gandalfDead = 1"],
		'passages': {
		},
	},
	'_continue43': {
		'text': "<p>It&#39;s daylight and you haven&#39;t a clue how you survived the troll&#39;s spear. Your wound is very painful, though.</p>\n<p>Aragorn finishes stiching you up and gives you some water. &quot;The troll missed all the vitals, but you&#39;ve lost a kidney. I&#39;ll carry you until we reach Lothlorien.&quot;</p>\n<p>You ask about Gandalf. The Fellowship hangs their heads in sorrow.</p>\n<p>&quot;We lost him on the bridge,&quot; Gimli says. &quot;He fell in a battle with the vicious Balrog.&quot;</p>\n<p>You share a moment of silence before carrying on.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue your journey to the forest of Lothlorien.\" role=\"link\" tabindex=\"0\">You continue your journey to the forest of Lothlorien.</a></p>",
		'passages': {
		},
	},
	'the whole mine is after you.': {
		'text': "<p>Hundreds of goblins pour out of the cracks in the walls. The Fellowship loses ground quickly as the horde gains up on them. It seems all is lost and your journey is at its end.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue44\" role=\"link\" tabindex=\"0\">And then the Balrog shows up.</a></p>",
		'passages': {
		},
	},
	'_continue44': {
		'text': "<p>The goblins quickly run away.</p>\n<p>A giant lumbering beast made of FIRE and SHADOW emerges from a distant corridor. It is the most terrible, and yet most awesome spectacle you have ever seen. The Balrog sees your Fellowship and charges towards you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue45\" role=\"link\" tabindex=\"0\">Gandalf flips out. &quot;RUN AWAY! RUN AWAY!&quot;</a></p>",
		'passages': {
		},
	},
	'_continue45': {
		'text': "<p>You all hurry to the bridge leading out of Moria. You cross the great chasm and make your way to the exit. The Balrog is hot on your heels.</p>\n<p>Halfway across the bridge, Gandalf realizes the Balrog will be soon upon you. He stops and turns to face his foe, brandishing his wizard staff. It glows with the power of secret fire.</p>\n<p>&quot;YOU! SHALL! NOT! GO! ACROSS! THIS! BRIDGE!&quot; Gandalf shouts.</p>\n<p>The Balrog tries to go across the bridge.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue46\" role=\"link\" tabindex=\"0\">Gandalf bangs his staff against the bridge.</a></p>",
		'passages': {
		},
	},
	'_continue46': {
		'text': "<p>The bridge collapses under the weight of the Balrog. It falls into darkness. Gandalf tumbles and holds onto the ledge, but his grasp is slipping.</p>\n<p>The cave begins to collapse. Gandalf looks at the Fellowship and shouts, &quot;Don&#39;t <a class=\"squiffy-link link-section\" data-section=\"try to save me\" role=\"link\" tabindex=\"0\">try to save me</a>, just <a class=\"squiffy-link link-section\" data-section=\"fly\" role=\"link\" tabindex=\"0\">fly</a>, you fools!&quot;</p>",
		'passages': {
		},
	},
	'try to save me': {
		'text': "<p>You run forward and slide towards Gandalf, arms outreached.</p>\n<p>{if jam=0:But your terrible punctuality causes you to hesitate a fraction of a second too late. Your fingers barely brush his and he falls into the darkness of Moria.}\n{if jam=0:{@gandalfDead=1}}\n{if jam=0:{@fellowship=6}}</p>\n<p>{if jam=1:Something encourages you to move faster than normal. Keeping a past promise about your punctuality, you&#39;re exactly a fraction of a second fast enough to grab the old man&#39;s hand. You pull Gandalf back up.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You leave the mines and return to the outside world.\" role=\"link\" tabindex=\"0\">You leave the mines and return to the outside world.</a></p>",
		'passages': {
		},
	},
	'fly': {
		'text': "<p>He falls into the darkness of Moria.</p>\n<p>The rest of you leave Moria, and Gandalf, behind.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You leave the mines and return to the outside world.\" role=\"link\" tabindex=\"0\">You leave the mines and return to the outside world.</a></p>",
		'attributes': ["gandalfDead = 1"],
		'passages': {
		},
	},
	'You leave the mines and return to the outside world.': {
		'text': "<p>It&#39;s daytime when you go outside. </p>\n<p>{if gandalfDead=1:Everyone&#39;s super-sad about Gandalf dying. Aragorn insists it couldn&#39;t have been avoided, but you&#39;re certain there are so many alternate ways you could have saved him. You wish you could save and restore your past choices, but Aragorn reminds you there&#39;s no time to grieve, and that this game only saves using cookies. You would literally have to replay the entire game just to try again.}</p>\n<p>{if gandalfDead=0:Gandalf&#39;s super-happy about you saving his life back on the bridge, certain that he was going to die. In a strange way, he feels like he missed out on a special opportunity with long-term repercussions. But he shakes that feeling off. Gandalf the Grey is here to stay!}</p>\n<p>&quot;Let&#39;s head to Lothlorien,&quot; Legolas says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue your journey to the forest of Lothlorien.\" role=\"link\" tabindex=\"0\">You continue your journey to the forest of Lothlorien.</a></p>",
		'passages': {
		},
	},
	'You continue your journey to the forest of Lothlorien.': {
		'text': "<p>You enter the dark and eerie woods.</p>\n<p>Legolas reminds everyone to <a class=\"squiffy-link link-section\" data-section=\"be super quiet and sneaky\" role=\"link\" tabindex=\"0\">be super quiet and sneaky</a> in this forest because of the elves who live here. To <a class=\"squiffy-link link-section\" data-section=\"be unnecessarily loud and obnoxious\" role=\"link\" tabindex=\"0\">be unnecessarily loud and obnoxious</a> may attract unwanted attention.</p>",
		'passages': {
		},
	},
	'be super quiet and sneaky': {
		'text': "<p>You try to be extra steathly, but Legolas&#39; warning was ill-timed. A troop of elven archers are quickly upon you. <a class=\"squiffy-link link-section\" data-section=\"You are escorted to their treehouse village\" role=\"link\" tabindex=\"0\">You are escorted to their treehouse village</a>.</p>",
		'passages': {
		},
	},
	'be unnecessarily loud and obnoxious': {
		'text': "<p>You scream and fart loudly for the whole forest to hear. A troop of elven archers are quickly upon you. <a class=\"squiffy-link link-section\" data-section=\"You are escorted to their treehouse village\" role=\"link\" tabindex=\"0\">You are escorted to their treehouse village</a>.</p>\n<p>{if gandalfDead=0:{@inc gandalfAngry}}</p>",
		'passages': {
		},
	},
	'You are escorted to their treehouse village': {
		'text': "<p>{if stabbedBySpear=1:The elves&#39; magic healers quickly patch you up and get you back on your feet. Aragorn is no longer carrying you.}</p>\n<p>The Fellowship meets with Lady Galadriel, a lovely Elven elder. She&#39;s totally hospitable and lets everyone have new clothes and showers. {if fellowship&lt;3:She is especially pleased to see you&#39;ve been traveling with a number of elves. She gives you extra shampoo to accommodate their needs.}\n{if fellowship&lt;3:{@hasShampoo=1}}</p>\n<p>{if gandalfDead=1:You tell her of Gandalf&#39;s passing in Moria. She is saddened, but gets over it and thanks you.}</p>\n<p>{if merryPippinFellFromMountain=1:You tell her of Merry and Pippin falling from Caradhras. She is saddened, but not much because she doesn&#39;t know or care about them.}</p>\n<p>{if gandalfDead=0:At one point, she and Gandalf sneak off together to do important grown-up stuff.}</p>\n<p>{if gandalfDead=0:{@galadrielHigh=1}}</p>\n<p>You enjoy some respite in the village.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue47\" role=\"link\" tabindex=\"0\">Later that night, you find a reflecting pool.</a></p>",
		'passages': {
		},
	},
	'_continue47': {
		'text': "<p>Inside the waters, you see a vision of the Shire burning under Mordor&#39;s fires. </p>\n<p>{if gandalfDead=1:Lady Galadriel enters the room. She tells you the vision will come to pass if you fail to destroy the Ring.} </p>\n<p>{if gandalfDead=1:She eyes your Ring with a greedy tinge and leans in slightly.} </p>\n<p>{if gandalfDead=1:In this moment, you feel compelled to <a class=\"squiffy-link link-section\" data-section=\"relinquish the Ring to her\" role=\"link\" tabindex=\"0\">relinquish the Ring to her</a>, but your itchy ring finger feels determined to <a class=\"squiffy-link link-section\" data-section=\"keep the Ring away from her.\" role=\"link\" tabindex=\"0\">keep the Ring away from her.</a>}</p>\n<p>{if gandalfDead=0:<a class=\"squiffy-link link-section\" data-section=\"Lady Galadriel and Gandalf suddenly enter the room.\" role=\"link\" tabindex=\"0\">Lady Galadriel and Gandalf suddenly enter the room.</a>}</p>",
		'passages': {
		},
	},
	'Lady Galadriel and Gandalf suddenly enter the room.': {
		'text': "<p>She and Gandalf are arm-in-arm, laughing and giggling up a storm. They both smell like they&#39;ve been smoking pipe-weed for the last several hours.</p>\n<p>&quot;No, really!&quot; Gandalf laughs to her. &quot;{if jam=0:He trapped me on the ROOF! I mean, what kind of dark wizard doesn&#39;t have a real dungeon?!}{if jam=1:I woke up in a hobbit hole with a lump on my head and whole day missing! And all because Frodo has butterfingers when it comes to raspberry jam!}&quot;</p>\n<p>&quot;Oh, look - it&#39;s Frodo!&quot; Galadriel squeals. &quot;You&#39;re so cute! Look at his little hobbit feet! They&#39;re so haaaiiiry!&quot;</p>\n<p>{if gandalfAngry&lt;5:&quot;Yeeeeah, Frodo&#39;s all right,&quot; Gandalf says. &quot;This little bugger&#39;s been a little pain, but he&#39;s such a little trooper, you know? This little hobbit&#39;s gonna save Middle-Earth!&quot;}</p>\n<p>{if gandalfAngry&lt;5:&quot;Oh, Gandalf; you and your hobbits!&quot; Galadriel laughs.}</p>\n<p>{if gandalfAngry&lt;5:&quot;I love me some hobbits!&quot; And they both stumble out, all buddy-like, leaving you confused and no longer concerned with the mirror pool.}</p>\n<p>{if gandalfAngry&gt;4:&quot;This little pain in the neck?&quot; Gandalf grumbles. &quot;I pretty much had to drag him across Middle-Earth just to get here. He{if gandalfRefusedQuest=1: refused to carry the Ring,}{if gandalfComplainedInMoria=1: complained every step of the way,}{if gandalfDissedOnMountain=1: complained every step of the way,}{if gandalfDraggedFromBree=1: had to be dragged out of Bree,}{if gandalfDraggedYouToCouncil=1: screamed like a baby in Rivendell,}{if gandalfLockedOut=1: and even tried to lock me out of his house}{if gandalfLockedOut=0: and doesn&#39;t even apologize when he farts}.&quot;}</p>\n<p>{if gandalfAngry&gt;4:&quot;Boooo! Boo on Frodo!&quot; Galadriel laughs.}</p>\n<p>{if gandalfAngry&gt;4:&quot;Yes, boo on Frodo! Frodo sucks!&quot; And they both stumble out, all buddy-like, leaving you confused and no longer concerned with the mirror pool&#39;s nightmarish vision.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"This was a weird layover.\" role=\"link\" tabindex=\"0\">This was a weird layover.</a></p>",
		'passages': {
		},
	},
	'keep the Ring away from her.': {
		'text': "<p>You step back and hide your Ring from her gaze. Unfortunately, this triggers a reflex. Her eyes go wild with madness, and Lady Galadriel lashes out, trying to take the Ring from you. </p>\n<p>You call for help as she chases you around the room, throwing magic spells at you. The guards immediately run in and subdue her. As they drag her out, she mutters something about &quot;failing the test, no thanks to you&quot;.</p>\n<p>The Ring appreciates your loyalty.</p>\n<p>The next morning, <a class=\"squiffy-link link-section\" data-section=\"you meet the Fellowship by the lake.\" role=\"link\" tabindex=\"0\">you meet the Fellowship by the lake.</a></p>",
		'attributes': ["precious+=1","galadrielFailed = 1"],
		'passages': {
		},
	},
	'relinquish the Ring to her': {
		'text': "<p>You offer her the Ring. She is taken by your offering and fantasizes about using its power to become Middle-Earth&#39;s most badass sorceress queen.</p>\n<p>But then she steps away and pats herself on the back, pleased that she did not give in to temptation. She lets you keep the Ring and runs off to make you something special for your trip.</p>\n<p>You spend the rest of the night watching visions in the reflecting pool. Some of the visions appear to be entertainment from the future. You fall asleep listening to a vision called &quot;Tommy Boy&quot;.</p>\n<p>The next morning, <a class=\"squiffy-link link-section\" data-section=\"you meet the Fellowship by the lake.\" role=\"link\" tabindex=\"0\">you meet the Fellowship by the lake.</a></p>",
		'passages': {
		},
	},
	'This was a weird layover.': {
		'text': "<p>You spend the night just chilling, watching a vision from the future called &quot;Tommy Boy&quot; in the mirror pool. Nothing of importance happens for the rest of your visit.</p>\n<p>The next day, <a class=\"squiffy-link link-section\" data-section=\"you meet the Fellowship by the lake.\" role=\"link\" tabindex=\"0\">you meet the Fellowship by the lake.</a></p>",
		'passages': {
		},
	},
	'you meet the Fellowship by the lake.': {
		'text': "<p>The elves have gathered some boats for your journey, and outfitted your team with new weapons and armour. You&#39;ve been given some fancy elf rope, loaves of elf bread, and an elf cloak.</p>\n<p>{if stabbedBySpear=0:{if galadrielFailed=0:Lady Galadriel offers you a magic phial. She tells you it contains light for the darkness ahead. You almost <a class=\"squiffy-link link-section\" data-section=\"thank her for the tiny phial\" role=\"link\" tabindex=\"0\">thank her for the tiny phial</a>, but secretly <a class=\"squiffy-link link-section\" data-section=\"wish she had something with more firepower\" role=\"link\" tabindex=\"0\">wish she had something with more firepower</a>.}}</p>\n<p>{if stabbedBySpear=0:{if galadrielFailed=1:Lady Galadriel is regretful of her actions the night before. She offers you a tiny magic phial as compensation. She doesn&#39;t have anything else in her bag, so you <a class=\"squiffy-link link-section\" data-section=\"thank her for the tiny phial\" role=\"link\" tabindex=\"0\">thank her for the tiny phial</a>.}}</p>\n<p>{if stabbedBySpear=1:Lady Galadriel hands you a tiny phial of light for the darkness ahead. She also imparts to you a vest of elven bright mail. She noticed you came without a kidney last night and says this armour will give you a +2 evasion modifier in future encounters. {if galadrielFailed=1:She hopes this makes up for her nonsense last night.}}\n{if stabbedBySpear=1:{@hasBrightMail=1}}</p>\n<p>{if stabbedBySpear=1:<a class=\"squiffy-link link-section\" data-section=\"The Fellowship sets off in their boats.\" role=\"link\" tabindex=\"0\">The Fellowship sets off in their boats.</a>}</p>",
		'passages': {
		},
	},
	'wish she had something with more firepower': {
		'text': "<p>Galadriel notices your disappointment with the phial and offers you something else. It&#39;s a tiny seed.</p>\n<p>&quot;Be careful where you plant this after you <a class=\"squiffy-link link-section\" data-section=\"leave Lothlorien\" role=\"link\" tabindex=\"0\">leave Lothlorien</a>,&quot; she says. &quot;It&#39;s fast-growing and very hostile in the darkness.{if gandalfDead=0: Plus, Gandalf and I were a little &#39;off&#39; with our magic last night, so... don&#39;t be surprised if it&#39;s a little unpredictable.}&quot;</p>\n<p>You accept the seed, still disappointed and <a class=\"squiffy-link link-passage\" data-passage=\"want something else\" role=\"link\" tabindex=\"0\">want something else</a>.</p>",
		'attributes': ["hasSeed = 1"],
		'passages': {
			'want something else': {
				'text': "<p>She hands you a DVD copy of &quot;Tommy Boy&quot; and walks away.</p>",
				'attributes': ["hasDVD = 1"],
			},
		},
	},
	'leave Lothlorien': {
		'text': "<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship sets off in their boats.\" role=\"link\" tabindex=\"0\">The Fellowship sets off in their boats.</a></p>",
		'passages': {
		},
	},
	'thank her for the tiny phial': {
		'text': "<p>She says &quot;You&#39;re welcome.&quot; And that&#39;s all you get.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship sets off in their boats.\" role=\"link\" tabindex=\"0\">The Fellowship sets off in their boats.</a></p>",
		'passages': {
		},
	},
	'The Fellowship sets off in their boats.': {
		'text': "<p>You sail down the river towards the Gates of Argonath. Two great statues mark the entrance into Gondor, one of the two countries on the border with Mordor. You continue downriver until you arrive at the shore of the ruined outpost, Amon Hen.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue48\" role=\"link\" tabindex=\"0\">You disembark from your boats.</a></p>",
		'passages': {
		},
	},
	'_continue48': {
		'text': "<p>&quot;We&#39;ll make camp here,&quot; Aragorn says. &quot;We&#39;re halfway to Mordor and should be fully rested in case of any surprises.&quot;</p>\n<p>{if gandalfDead=0:Gandalf pipes up. &quot;By the way, Galadriel taught me a healing spell back in Lothlorien. It&#39;s not much, but I can probably cure at least three life-threatening arrow wounds should such a need arise.&quot;}</p>\n<p>&quot;I&#39;ll <a class=\"squiffy-link link-section\" data-section=\"go gather firewood\" role=\"link\" tabindex=\"0\">go gather firewood</a>,&quot; Boromir says. &quot;Frodo! Dear, dear, Frodo, I <a class=\"squiffy-link link-section\" data-section=\"do not\" role=\"link\" tabindex=\"0\">do not</a> suppose you&#39;d like to join me?&quot; </p>",
		'passages': {
		},
	},
	'do not': {
		'text': "<p>You decide to stay with the Fellowship, leaving Boromir to collect firewood on his own. </p>\n<p>&quot;Frodo, come see this!&quot; Aragorn calls you over to a dias where a stone throne sits amongs the ruins. &quot;This is the famous Seat of Seeing. It&#39;s a magic chair. If you <a class=\"squiffy-link link-section\" data-section=\"sit in it\" role=\"link\" tabindex=\"0\">sit in it</a>, you can see for miles around.&quot;</p>\n<p>The Seat beckons to you, suggesting you might want to <a class=\"squiffy-link link-section\" data-section=\"play it safe\" role=\"link\" tabindex=\"0\">play it safe</a> around this thing.</p>",
		'passages': {
		},
	},
	'sit in it': {
		'text': "<p>But what&#39;s the harm in sitting down? You lounge back in the Seat of Seeing and let the chair&#39;s magic whisk you away.</p>\n<p>Suddenly, you&#39;re looking down on Middle-Earth from above. You can see the top of yours and Aragorn&#39;s heads. If you zoom out, you can see Mordor in the distance, and Mt. Doom&#39;s fiery glow. If you zoom out even farther, you&#39;re startled to see the world is round, and there are more than just dragons beyond the map&#39;s edge. Zooming out to maximum, you see the vast expanse of the universe and realize how insignificant you really are.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You also see a squadron of orcs heading your way.\" role=\"link\" tabindex=\"0\">You also see a squadron of orcs heading your way.</a></p>",
		'passages': {
		},
	},
	'play it safe': {
		'text': "<p>You tell Aragorn it might be better if you avoid bringing the Ring near the Seat. Using the Seat&#39;s power might signal the Ring&#39;s location.</p>\n<p>So Aragorn gives it a shot. He sits in the chair and suddenly goes cross-eyed. He gazes at the vast immensity of the universe.</p>\n<p>&quot;Oh, my god...&quot; he mutters, &quot;it&#39;s full of STARS.&quot;</p>\n<p>He suddenly sees something coming.</p>\n<p>&quot;Frodo, <a class=\"squiffy-link link-section\" data-section=\"warn the others!\" role=\"link\" tabindex=\"0\">warn the others!</a>&quot; he exclaims. &quot;Saruman&#39;s Uruk-Hai are coming!&quot;</p>",
		'passages': {
		},
	},
	'warn the others!': {
		'text': "<p>Sure enough, a group of armour-clad orcs come storming through the woods. Your warning is enough to help the Fellowship get the drop on them. Gimli and Legolas are first into battle.{if fellowship=3:{if merryPippinFellFromMountain=0: Sam, Merry, and Pippin charge after them.}}{if fellowship&lt;3: Arwen and Glorfy hide in the trees and snipe any stragglers.}{if fellowship=1: Beorn goes into bear-mode and does his thing.}{if gandalfDead=0: Gandalf fires bolts of chain lightning into the fray.}</p>\n<p>{if fellowship&gt;1:&quot;We got &#39;em on the run!&quot; Sam exclaims.}</p>\n<p>As Aragorn joins the fight, he says, &quot;Through the Seat&#39;s power, I&#39;ve seen beyond the borders. Though we must <a class=\"squiffy-link link-section\" data-section=\"bring the Ring to Mordor\" role=\"link\" tabindex=\"0\">bring the Ring to Mordor</a>, the tower of Isengard threatens the people of Rohan. There&#39;s an opportunity to defeat Sauron and save even more lives if the Fellowship were to <a class=\"squiffy-link link-section\" data-section=\"travel to Rohan\" role=\"link\" tabindex=\"0\">travel to Rohan</a> instead.&quot;</p>",
		'passages': {
		},
	},
	'bring the Ring to Mordor': {
		'text': "<p>{if hasSwordSting=1:You stab a nearby Orc with Sting and address Aragorn.}{if hasSwordSting=0:{if hasButterknife=1:You stab a nearby Orc with your butterknife and address Aragorn.}}{if hasSwordSting=0:{if hasButterknife=0:You kick an Orc in the shin and address Aragorn.}}</p>\n<p>You remind him of your mission to Mordor and how destroying the Ring is your best chance of winning this war. With a heavy heart, he agrees and cut down another orc.</p>\n<p>&quot;Thank you, Frodo,&quot; he says as the Fellowship finishes slaughtering the Orcs. &quot;<a class=\"squiffy-link link-section\" data-section=\"The Fellowship will continue to Mordor\" role=\"link\" tabindex=\"0\">The Fellowship will continue to Mordor</a> as planned.&quot;</p>",
		'passages': {
		},
	},
	'travel to Rohan': {
		'text': "<p>You decide you&#39;ve had it with Mordor. You want to go to Rohan.</p>\n<p>&quot;Excellent, thank you, Frodo!&quot; Aragorn smiles. In his delight, he doesn&#39;t see the last orc coming. An Uruk-Hai knocks Aragorn down the hill and he rolls into the water.</p>\n<p>You&#39;re suddenly scooped up. The orc tells the others, &quot;We have the halfing{if fellowship=3:{if merryPippinFellFromMountain=0:s}}! Let us away to Isengard!&quot;</p>\n<p>The orcs escape the Fellowship with you stuffed in a bag.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are carried away towards Rohan.\" role=\"link\" tabindex=\"0\">You are carried away towards Rohan.</a></p>",
		'passages': {
		},
	},
	'You also see a squadron of orcs heading your way.': {
		'text': "<p>You warn Aragorn of the orcs coming. He calls a warning to the Fellowship to plot an ambush. Everyone is quick to prepare and faster to strike. Legolas is first to strike with a hail of arrows fired through the woods. {if fellowship&lt;3:Arwen and Glorfy follow up with additional hails, turning the sky into a death barrage of falling arrows. }{if fellowship=1:Beorn assumes bear-form and tackles the first guy he sees, going full-Revenant on the orc&#39;s non-DiCaprio keister.} </p>\n<p>Boromir and Gimli quickly join you and Aragorn as you defend the hilltop.{if fellowship&gt;1: Sam rallies with you and holds the line against the invaders {if fellowship=3:{if merryPippinFellFromMountain=0:with Merry and Pippin}}}.{if gandalfDead=0: Gandalf joins in with some chain lighting to even the odds.}</p>\n<p>The Fellowship easily overwhelms the attacking Uruk-Hai, none of whom manage to retreat.</p>\n<p>&quot;Cool beans,&quot; Aragorn says, sheathing his sword. &quot;Saruman will think twice about sending more of his men. When everyone&#39;s rested, let&#39;s get back in the boats. I see no reason for lingering around here.&quot;</p>\n<p>It&#39;s decided. <a class=\"squiffy-link link-section\" data-section=\"The Fellowship will continue to Mordor\" role=\"link\" tabindex=\"0\">The Fellowship will continue to Mordor</a>.</p>",
		'passages': {
		},
	},
	'go gather firewood': {
		'text': "<p>You happily go gather firewood with your dear friend, Boromir, certain that nothing will go wrong.</p>\n<p>Once you&#39;re out of the others&#39; earshot, Boromir speaks. &quot;You know, Frodo, my father is Denethor, King of Gondor. He&#39;s been defending this land against Mordor for years and could certainly use that Ring of yours to win this war. It would be a real shame if it were to be destroyed, don&#39;t you agree?&quot;</p>\n<p>He hitches up his pants.</p>\n<p>{if boromirRemembers=1:&quot;And let&#39;s get real; the first thing you did when we met was try to give me the Ring. Face it, you want to use its power for good too, don&#39;t you? We can do it together, Frodo.{if witchKingDanceOff=1: We could even sing a few songs along the way if you fancy that.}&quot;}</p>\n<p>&quot;So what do you say? Shall we <a class=\"squiffy-link link-section\" data-section=\"join forces and save Gondor\" role=\"link\" tabindex=\"0\">join forces and save Gondor</a>, or <a class=\"squiffy-link link-section\" data-section=\"continue on this silly quest?\" role=\"link\" tabindex=\"0\">continue on this silly quest?</a>&quot;</p>",
		'passages': {
		},
	},
	'continue on this silly quest?': {
		'text': "<p>You politely decline Boromir&#39;s offer. He is mildly disappointed.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue49\" role=\"link\" tabindex=\"0\">And then he pounces on you like a wildcat.</a></p>",
		'attributes': ["boromirTriedToTakeRing = 1"],
		'passages': {
		},
	},
	'_continue49': {
		'text': "<p>You and Boromir wrestle on the ground. He struggles to take your Ring, and in the fiasco, it ends up on your finger.</p>\n<p>You slip away invisible as Boromir frantically searches for you.</p>\n<p>You make your way back to the Fellowship, but pause and wonder how long it&#39;ll be before they try to take your Precious Ring.</p>\n<p>This becomes a moment of truth. Do you <a class=\"squiffy-link link-section\" data-section=\"continue to Mordor alone\" role=\"link\" tabindex=\"0\">continue to Mordor alone</a>, or <a class=\"squiffy-link link-section\" data-section=\"keep the Fellowship together\" role=\"link\" tabindex=\"0\">keep the Fellowship together</a>?</p>",
		'passages': {
		},
	},
	'keep the Fellowship together': {
		'text': "<p>You decide to return to the Fellowship, only to discover they&#39;ve been attacked by a horde of orcs. Invisible, you quickly tackle some from behind, enabling your friends to easily cut them down.</p>\n<p>{if fellowship=3:{if merryPippinFellFromMountain=0:You help Merry and Pippin get away from a pair of grabby orcs. They seem eager to stick all the hobbits in a bag. Aragorn makes short work of them.}}</p>\n<p>The Orcs are overwhelmed and retreat, so you remove the Ring.</p>\n<p>The Fellowship is intact, for now. You immediately tell Aragorn what transpired between you and Boromir. Aragorn looks furious, but his anger wavers as he sees Boromir coming in over the hill with an arrow in his shoulder. It seems he too was attacked after you ran from him.</p>\n<p>{if gandalfDead=0:Gandalf looks at the arrow wound and smiles as he charges up his new healing spell.}\n{if gandalfDead=1:Aragorn pulls out his first-aid kit.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue50\" role=\"link\" tabindex=\"0\">Boromir&#39;s wound is treated.</a></p>",
		'passages': {
		},
	},
	'_continue50': {
		'text': "<p>&quot;I&#39;m so sorry,&quot; Boromir cries. &quot;I tried to take the Ring... I see now the madness it commands. Please <a class=\"squiffy-link link-passage\" data-passage=\"forgive me\" role=\"link\" tabindex=\"0\">forgive me</a>, Frodo. Please.&quot;</p>\n<p>&quot;We will not leave him like this,&quot; Aragorn says to the Fellowship. &quot;Boromir, you will make amends by <a class=\"squiffy-link link-section\" data-section=\"joining us in Mordor\" role=\"link\" tabindex=\"0\">joining us in Mordor</a>.&quot;</p>",
		'passages': {
			'forgive me': {
				'text': "<p>You forgive Boromir. He smiles gently and sincerely.</p>",
				'attributes': ["boromirForgiven = 1"],
			},
		},
	},
	'joining us in Mordor': {
		'text': "<p>&quot;Yes, indeed I will finish this quest,&quot; he says as Aragorn finishes patching up his wound. &quot;I will not give in to fear again, I promise.&quot;</p>\n<p>&quot;Very well,&quot; Aragorn says to everyone. &quot;<a class=\"squiffy-link link-section\" data-section=\"The Fellowship will continue to Mordor\" role=\"link\" tabindex=\"0\">The Fellowship will continue to Mordor</a>, so rest up.&quot;</p>",
		'passages': {
		},
	},
	'continue to Mordor alone': {
		'text': "<p>You head back to the river and board a boat before anyone sees you. You push off from shore.</p>\n<p>{if fellowship&gt;1:But Sam&#39;s been watching you from afar and swims out to your boat, shouting &quot;Don&#39;t go without me, Mr. Frodo! Don&#39;t you dare leave your Sam behind!&quot;}</p>\n<p>{if fellowship&gt;1:Of course, Sam can&#39;t swim and sinks immediately. You&#39;re forced to choose between going back to <a class=\"squiffy-link link-section\" data-section=\"rescue Sam\" role=\"link\" tabindex=\"0\">rescue Sam</a> or trusting <a class=\"squiffy-link link-section\" data-section=\"he'll be fine\" role=\"link\" tabindex=\"0\">he&#39;ll be fine</a>.}</p>\n<p>{if fellowship=1:<a class=\"squiffy-link link-section\" data-section=\"Your lone journey into Mordor begins.\" role=\"link\" tabindex=\"0\">Your lone journey into Mordor begins.</a>}</p>",
		'passages': {
		},
	},
	'he\'ll be fine': {
		'text': "<p>You&#39;re certain Sam can walk back to shore once he touches the bottom of the lake. He&#39;s quite good at holding his breath, and it&#39;s not like there&#39;s a waterfall or any strong currents around here.</p>\n<p>But... you don&#39;t see him come back up.</p>\n<p>Your heart sinks and you wonder what kind of monster you&#39;ve become. You are without Sam. Without Fellowship. All you have is your boat... and your Precious.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Your lone journey into Mordor begins.\" role=\"link\" tabindex=\"0\">Your lone journey into Mordor begins.</a></p>",
		'attributes': ["samDrowned = 1","frodoAlone = 1"],
		'passages': {
		},
	},
	'rescue Sam': {
		'text': "<p>You turn the boat around and find Sam slowly sinking into the water. You drag him into the boat.</p>\n<p>&quot;Bless you, Mr. Frodo!&quot; he exclaims. &quot;I saw what happened with Boromir, and I whole-heartedly agree - we don&#39;t need the Fellowship! We&#39;ll save Middle-Earth together, just you and your Sam - you&#39;ll see!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You journey to Mordor with Sam.\" role=\"link\" tabindex=\"0\">You journey to Mordor with Sam.</a></p>",
		'attributes': ["samSaved = 1"],
		'passages': {
		},
	},
	'The Fellowship will continue to Mordor': {
		'text': "<p>The Fellowship heads back to the river and boards their boats. You push off from shore and <a class=\"squiffy-link link-section\" data-section=\"the Fellowship begins their ultimate journey into Mordor.\" role=\"link\" tabindex=\"0\">the Fellowship begins their ultimate journey into Mordor.</a></p>",
		'passages': {
		},
	},
	'join forces and save Gondor': {
		'text': "<p>You decide the Fellowship be damned and tell Boromir you want to help him use the Ring to fight back. Boromir is delighted at your response.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue51\" role=\"link\" tabindex=\"0\">You shake hands and form a secret partnership.</a></p>",
		'passages': {
		},
	},
	'_continue51': {
		'text': "<p>You know the Fellowship wouldn&#39;t approve, so the two of you steal away and head upriver.</p>\n<p>But as you travel, you are set upon by a horde of orcs. Among them is an elite: the Uruk-hai.</p>\n<p>Boromir blows his horn and calls for aid, but he quickly gets skewered by arrows from all directions. He falls to the ground as you are captured and stuffed in a bag.</p>\n<p>{if gandalfDead=0:Boromir&#39;s fate is left unknown as you are taken prisoner.}\n{if gandalfDead=1:Boromir is now dead and you are a prisoner.}\n{if gandalfDead=1:{@boromirDead=1}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are carried away towards Rohan.\" role=\"link\" tabindex=\"0\">You are carried away towards Rohan.</a></p>",
		'passages': {
		},
	},
	'But you aren\'t going anywhere.': {
		'text': "<p>Your boat stops and heads back to shore. You are being pushed by a large hairy beast who surfaces and reveals himself as Beorn in bear form. </p>\n<p>He growls loudly, &quot;I AM BEEEEEAAAARRRR!!!&quot;</p>\n<p>Then he turns back into a man, sits in the boat, and has a heart-to-heart with you about your encounter with Boromir.</p>\n<p>Through his words, you learn that you can&#39;t let one betrayal shatter your faith in others. He encourages you to forgive Boromir&#39;s actions and <a class=\"squiffy-link link-section\" data-section=\"keep the Fellowship together\" role=\"link\" tabindex=\"0\">keep the Fellowship together</a>. His words move you deeply and you see no other way forward.</p>",
		'passages': {
		},
	},
	'the Fellowship begins their ultimate journey into Mordor.': {
		'text': "<p>{if fellowship=3:{if pippinDead=0:{@merryPippinInMordor=1}}}\nYou ride downriver towards the Gondor bordor, the Mountains of Ash looming in the distance.</p>\n<p>Your Fellowship is yourself, {if gandalfDead=0:Gandalf, }Aragorn, Gimli, Legolas,{if fellowship&gt;1: Sam, }{if merryPippinInMordor=1: Merry, Pippin, }{if fellowship&lt;3: Arwen, Glorfy, }{if fellowship=1: Beorn, } and Boromir.</p>\n<p>{if boromirTriedToTakeRing=1:Boromir feels sad that he gave in to the Ring&#39;s dark temptation and almost destroyed the Fellowship. {if boromirForgiven=1:He is glad that you forgave him and swears to do better.} {if boromirForgiven=0:But he stays quiet throughout the ride, his mind on other things to come.}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue52\" role=\"link\" tabindex=\"0\">You arrive at the hills of Emyn Muil and continue your journey on foot.</a></p>",
		'passages': {
		},
	},
	'_continue52': {
		'text': "<p>One night, as you rest under some cliffs, you are rudely awakened by a loud &#39;twang&#39; and a scream. You sit up in time to see a strange, scrawny creature fall over dead at your feet with an arrow through his head. </p>\n<p>Legolas approaches, his bow drawn, and looks at the creature. It&#39;s a half-starved, hobbit-like creature with bulbous eyes and a loincloth.</p>\n<p>&quot;He tried to bash your brains out in your sleep,&quot; Legolas tells you.</p>\n<p>{if gandalfDead=0:Gandalf sits up. &quot;It is the creature, Gollum. He&#39;s been following us for some time, though I didn&#39;t imagine he would approach the Fellowship so brashly. I believed he might play a bigger role in times to come, but I suppose I was wrong.&quot;}\n{if gandalfDead=1:You recognize the creature from your uncle&#39;s stories. It is the creature, Gollum, the previous owner of the Ring. You are surprised that he found you all the way out here, but it seems his journey is now done.}</p>\n<p>{if fellowship=1:<a class=\"squiffy-link link-section\" data-section=\"Beorn wakes up and addresses the team.\" role=\"link\" tabindex=\"0\">Beorn wakes up and addresses the team.</a>}</p>\n<p>{if fellowship&gt;1:<a class=\"squiffy-link link-section\" data-section=\"The Fellowship rests and soon heads southeast towards Mordor.\" role=\"link\" tabindex=\"0\">The Fellowship rests and soon heads southeast towards Mordor.</a>}</p>",
		'passages': {
		},
	},
	'The Fellowship rests and soon heads southeast towards Mordor.': {
		'text': "<p>{if gandalfDead=0:As you approach some swamps, you see Aragorn and Gandalf having a dispute about the road ahead.}\n{if gandalfDead=1:As you approach some swamps, you see Aragorn scope out the road ahead and make some hard choices. Without Gandalf, everyone looks to him as leader now.}</p>\n<p>Aragorn tells the team, &quot;Beyond these hills are the Dead Marshes. If we cross them and follow the mountains past the Black Gate, there are old paths into Mordor. Providing we aren&#39;t spotted by their scouts... or our own.&quot;</p>\n<p>{if gandalfDead=0:But Gandalf chimes in, &quot;The Mountains of Shadow take us too close to Minas Morgul. I feel if we take the longer northern route, across the Plains of Dagorlad, we can hide under the cover of a dust storm and use a nameless route through the Mountains of Ash into Mordor.&quot;}</p>\n<p>{if gandalfDead=0:&quot;What say the Ring-Bearer?&quot; Aragorn asks. &quot;Should we <a class=\"squiffy-link link-section\" data-section=\"cross the Marshes towards the Black Gate\" role=\"link\" tabindex=\"0\">cross the Marshes towards the Black Gate</a>, or <a class=\"squiffy-link link-section\" data-section=\"venture north across the Plains of Dagorlad\" role=\"link\" tabindex=\"0\">venture north across the Plains of Dagorlad</a>?&quot;}</p>\n<p>{if gandalfDead=1:Nobody present has any better ideas, so you <a class=\"squiffy-link link-section\" data-section=\"cross the Marshes towards the Black Gate\" role=\"link\" tabindex=\"0\">cross the Marshes towards the Black Gate</a>.}</p>",
		'passages': {
		},
	},
	'venture north across the Plains of Dagorlad': {
		'text': "<p>You like Gandalf&#39;s &#39;journey into the unknown&#39; idea. You decide to forego the Dead Marshes and journey north into the plains.</p>\n<p>&quot;So be it,&quot; Aragorn says. &quot;This route is beyond my knowing. Gandalf, you shall take the lead.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue53\" role=\"link\" tabindex=\"0\">You all follow Gandalf north.</a></p>",
		'passages': {
		},
	},
	'_continue53': {
		'text': "<p>Gandalf tells you the story of Dagorlad, the plains where the Last Alliance of men and elves fought Sauron&#39;s forces before their final assault on the Black Gate. Much of the fallen soldiers sank into the wetlands long ago, and all that remains of the plains now is a cold, treeless desert.</p>\n<p>{if merryPippinInMordor=1:Merry and Pippin comment that it sounds like the same story Gandalf tells about every place. Gandalf tells them to stuff it.} \n{if fellowship&lt;3:Glorfy remembers the war and tells everyone that he did the coolest triple-backflip during the battle, as elves are wont to do.}</p>\n<p>And just as Gandalf foresaw, a dust storm rises up to cover your passage across the plain. You all hide under your cloaks.</p>\n<p>&quot;Follow my voice,&quot; Gandalf says as you journey into the cloud.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue54\" role=\"link\" tabindex=\"0\">This turns out to be the worst stretch of your journey.</a></p>",
		'passages': {
		},
	},
	'_continue54': {
		'text': "<p>The blowing wind bites at your exposed skin and the sand finds its way into all your openings as you cross the perilous desert. Hours pass in this miserable wasteland.</p>\n<p>Gimli has to ride on Legolas&#39; back just to keep the lightweight elf from being blown away. {if fellowship&lt;3:Aragorn and Boromir also ride piggy-back on Arwen and Glorfy.}</p>\n<p>Sam mutters, &quot;This is terrible. Can&#39;t stop for food. No campfire. Surely Gandalf&#39;s magic would help a great deal.&quot;</p>\n<p>&quot;Just a little further,&quot; Gandalf calls. &quot;There&#39;s shelter ahead.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue55\" role=\"link\" tabindex=\"0\">You find a trench in the earth.</a></p>",
		'passages': {
		},
	},
	'_continue55': {
		'text': "<p>It offers little shelter, but crossing through the trench gives you brief respite from the storm.</p>\n<p>You realize your Ring has been acting up since you entered these lands. It wants to pull you in all directions. As you feel faint, Gandalf shakes you to alertness.</p>\n<p>You tell him of the Ring. He replies, &quot;There were many evils in the First Alliance war and before. Many may still linger in these lands. But we shouldn&#39;t mind the demons of the past as the Ring does. I must ask of you, Frodo, not to <a class=\"squiffy-link link-passage\" data-passage=\"wear the Ring traveling north\" role=\"link\" tabindex=\"0\">wear the Ring traveling north</a>. Where we are going, you must <a class=\"squiffy-link link-section\" data-section=\"keep it protected and out of sight.\" role=\"link\" tabindex=\"0\">keep it protected and out of sight.</a>&quot;</p>",
		'passages': {
			'wear the Ring traveling north': {
				'text': "<p>You put it on. Gandalf smacks it out of your hands.</p>\n<p>&quot;What did I just say?! I literally asked you not to do ONE THING. Don&#39;t wear it! Don&#39;t wear the Ring! Just don&#39;t!&quot;</p>",
				'attributes': ["precious+=1","gandalfAngry+=1"],
			},
		},
	},
	'keep it protected and out of sight.': {
		'text': "<p>You slide the Ring into a hole within your vest pocket. It&#39;s hard to remove, but no one will see it now.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue56\" role=\"link\" tabindex=\"0\">The Fellowship reaches the end of the trenches and you arrive at a stone clearing.</a></p>",
		'passages': {
		},
	},
	'_continue56': {
		'text': "<p>While the stones offer protection, Gandalf&#39;s heart sinks at the sight of things. Surrounding you are the bodies of eagles, bloodied and lifeless.</p>\n<p>&quot;What is the meaning of this?&quot; Gimli asks.</p>\n<p>Gandalf falters. He sees one eagle moving listlessly and runs to its side. They appear to know one another.</p>\n<p>&quot;Gwaihir, what happened here?&quot; Gandalf asks.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue57\" role=\"link\" tabindex=\"0\">Gwaihir struggles to speak.</a></p>",
		'passages': {
		},
	},
	'_continue57': {
		'text': "<p>&quot;I was privately bequested by the Lady of Lothlorien to meet you at this place and secure you a safe flight over the mountains. I brought my truest warriors to aid you, but there was a traitor among us. Meneldor&#39;s been colluding with the wizard Saruman.{if eaglesComing=1: After seeing the Ring on Caradhras, he rallied many more eagles to ensnare us.}{if eaglesComing=0: We were able to kill him and decimate his numbers, but I fear there are none left to carry you over the mountains.}&quot;</p>\n<p>Gandalf tries to work his healing magic, but Gwaihir&#39;s wounds are too deep.</p>\n<p>&quot;Gandalf, beware, Saruman&#39;s possession of a Palantir had awakened something even darker in this land. It is bound to the mountain, so you must <a class=\"squiffy-link link-section\" data-section=\"flee back to Gondor\" role=\"link\" tabindex=\"0\">flee back to Gondor</a> lest it finds you.&quot;</p>\n<p>Gwaihir dies in Gandalf&#39;s arms. Gandalf is skeptical about his plan to <a class=\"squiffy-link link-section\" data-section=\"carry on over the mountains\" role=\"link\" tabindex=\"0\">carry on over the mountains</a>.</p>",
		'passages': {
		},
	},
	'flee back to Gondor': {
		'text': "<p>As Ring-Bearer, you suggest taking the Eagle Lord&#39;s advice and crossing back over the desert. The Dead Marshes didn&#39;t look so bad.</p>\n<p>&quot;Very well,&quot; Gandalf says. &quot;We&#39;ll return to the Black Gate.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue58\" role=\"link\" tabindex=\"0\">The Fellowship heads back into the storm.</a></p>",
		'passages': {
		},
	},
	'_continue58': {
		'text': "<p>But something has changed. Gandalf&#39;s sense of direction seems askew as you wander the sands. You know you&#39;re retracing your steps, but Gandalf keeps looking around as if you&#39;re lost.</p>\n<p>&quot;Is there a problem?&quot; Aragorn asks him.</p>\n<p>&quot;The sands are shifting,&quot; Gandalf says. &quot;The path looks the same, but it leads us elsewhere. This is Saruman&#39;s work. We&#39;ve lost the trail back to Gondor.&quot;</p>\n<p>Aragorn readies his sword. &quot;Then we face whatever Saruman guides us to.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You journey blind into the storm.\" role=\"link\" tabindex=\"0\">You journey blind into the storm.</a></p>",
		'passages': {
		},
	},
	'carry on over the mountains': {
		'text': "<p>You remind Gandalf that he didn&#39;t plan for the Eagles to appear, and you can still climb the mountains as per the plan.</p>\n<p>&quot;Yes,&quot; Gandalf nods. &quot;We&#39;ll make for the Nameless Pass.&quot;</p>\n<p>He guides you back into the storm, heading for the Mountains of Ash.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue59\" role=\"link\" tabindex=\"0\">But he soon finds the mountains are unfamiliar to him.</a></p>",
		'passages': {
		},
	},
	'_continue59': {
		'text': "<p>&quot;We aren&#39;t where we should be,&quot; Aragorn says. &quot;These peaks are not on any map.&quot;</p>\n<p>&quot;What trickery is this?&quot; Boromir asks.</p>\n<p>&quot;This is the work of Saruman,&quot; Gandalf says. &quot;Gwaihir is right. By crossing this land, we&#39;ve entered a terrible trap. I am so sorry.&quot;</p>\n<p>Aragorn readies his sword. &quot;Then we face whatever Saruman guides us to.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You journey blind into the storm.\" role=\"link\" tabindex=\"0\">You journey blind into the storm.</a></p>",
		'passages': {
		},
	},
	'You journey blind into the storm.': {
		'text': "<p>You arrive at the base of the mountains and find a passage through the crags. Of course, this passage is unfamiliar to Gandalf.</p>\n<p>&quot;This is not the pass I spoke of,&quot; he mutters. &quot;There is something ancient and very wrong about this place.&quot;</p>\n<p>The dust storm settles, and the Fellowship finds itself in front of a large, black gateway. The gate is open and a terrible void lies within. An eerie purple orb adorns the gateway&#39;s frame.</p>\n<p>Gandalf looks petrified at the sight of it. &quot;I know of this gate. It is the Door of Night. We must leave immediately!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue60\" role=\"link\" tabindex=\"0\">You all turn and face a white wizard.</a></p>",
		'passages': {
		},
	},
	'_continue60': {
		'text': "<p>{if jam=0:&quot;I thought I had you back at Isengard, old friend,&quot; Saruman says.}\n{if jam=1:&quot;I expected to meet you at Isengard, old friend,&quot; Saruman says.}</p>\n<p>The Fellowship is shocked to see Saruman in his white robes, barring the exit from the pass, his back to the storm. He shimmers like a ghostly apparition.</p>\n<p>&quot;What is the meaning of this?&quot; Gandalf asks.</p>\n<p>&quot;I came for you at the mountain pass, and at the river&#39;s bank. Three times you&#39;ve evaded me, Gandalf, but it seems destiny has drawn you here, where my power is at its strongest.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue61\" role=\"link\" tabindex=\"0\">Legolas fires an arrow at Saruman.</a></p>",
		'passages': {
		},
	},
	'_continue61': {
		'text': "<p>The arrow passes through his neck, leaving no mark.</p>\n<p>&quot;It&#39;s just an illusion,&quot; Aragorn says. &quot;You have no power here, Saruman.&quot;</p>\n<p>&quot;I have a Palantir, as does this gate,&quot; Saruman explains. &quot;I have communed with the dark forces within, and brought this gateway into Middle-Earth. For that, my true master has secured my partnership with the Dark Lord. Regardless of who shares power, my victory is absolute. And once you relinquish the Ring, so will be your imprisonment.&quot;</p>\n<p>&quot;We&#39;ll never give you anything!&quot; Sam shouts.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue62\" role=\"link\" tabindex=\"0\">Saruman waves in his reinforcements through the storm.</a></p>",
		'passages': {
		},
	},
	'_continue62': {
		'text': "<p>Legolas sees an army through the winds. &quot;Three garrisons of orcs and men, with three oliphaunts, twenty Olog-hai, and someone riding a fellbeast. It&#39;s the Witch King{if witchKingDead=1:, back from the dead}.&quot;</p>\n<p>{if merryPippinInMordor=1:With four hobbits in tow, Aragorn doesn&#39;t think this Fellowship stands a fighting chance.}</p>\n<p>{if fellowship=2:Even with three elves and a wizard, Aragorn doesn&#39;t fancy your chances.}</p>\n<p>&quot;Bring me that hobbit,&quot; Saruman orders the Witch King, pointing at you. &quot;Kill the rest.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue63\" role=\"link\" tabindex=\"0\">The Witch King swoops down on his fellbeast towards you.</a></p>",
		'passages': {
		},
	},
	'_continue63': {
		'text': "<p>Sam pushes you out of the way and gets scooped up instead. He&#39;s carried away over the mountains by the Witch King. You call out to Sam, but he is gone.\n{if fellowship=3:{if merryPippinInMordor=0:{@samTakenAway=1}}}</p>\n<p>Saruman vanishes and his forces enter the pass to kill you.</p>\n<p>&quot;We should <a class=\"squiffy-link link-section\" data-section=\"retreat into the gateway\" role=\"link\" tabindex=\"0\">retreat into the gateway</a>&quot;, Gimli says.</p>\n<p>&quot;NO!&quot; Gandalf snaps. With uncertainty, he says, &quot;We stand a better chance if we <a class=\"squiffy-link link-section\" data-section=\"fight this horde together\" role=\"link\" tabindex=\"0\">fight this horde together</a>. That gateway is an eternal prison!&quot;</p>",
		'passages': {
		},
	},
	'fight this horde together': {
		'text': "<p>You charge towards your attackers with Aragorn behind you. Legolas, Gimli, and Boromir charge along while Gandalf fires ranged magic attacks{if fellowship=2: with the backup of Arwen and Glorfy&#39;s arrows}. {if merryPippinInMordor=1:Merry and Pippin take their time joining in.}</p>\n<p>Legolas strikes down three trolls and ten orcs instantly.{if fellowship=2: Arwen and Glorfy take down twenty more on the sides.} Aragorn and Boromir cut into the ranks while Gandalf fire-blasts the oliphaunts. You&#39;re barely holding the line in this narrow pass.</p>\n<p>A rain of arrows comes down around you.</p>\n<p>{if fellowship=2:<a class=\"squiffy-link link-section\" data-section=\"Glorfy is hit!\" role=\"link\" tabindex=\"0\">Glorfy is hit!</a>}\n{if fellowship=3:{if merryPippinInMordor=0:<a class=\"squiffy-link link-section\" data-section=\"You are miraculously unharmed so far.\" role=\"link\" tabindex=\"0\">You are miraculously unharmed so far.</a>}}\n{if fellowship=3:{if merryPippinInMordor=1:{if hasMythrilVest=0:<a class=\"squiffy-link link-section\" data-section=\"Merry is hit!\" role=\"link\" tabindex=\"0\">Merry is hit!</a>}}}\n{if fellowship=3:{if merryPippinInMordor=1:{if hasMythrilVest=1:<a class=\"squiffy-link link-section\" data-section=\"Merry is in the middle of it.\" role=\"link\" tabindex=\"0\">Merry is in the middle of it.</a>}}}</p>",
		'passages': {
		},
	},
	'Glorfy is hit!': {
		'text': "<p>He takes an arrow in the shoulder and falls back into Arwen&#39;s arms. Legolas calls out to them and begs Aragorn for a retreat.</p>\n<p>&quot;Yes, into the gate!&quot; Aragorn shouts, against Gandalf&#39;s protests.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You run back towards the gate.\" role=\"link\" tabindex=\"0\">You run back towards the gate.</a></p>",
		'attributes': ["glorfyHit = 1"],
		'passages': {
		},
	},
	'You are miraculously unharmed so far.': {
		'text': "<p>But Aragorn can&#39;t handle it anymore. The dust is choking the Fellowship and you can&#39;t last another minute in this fight.</p>\n<p>&quot;Everyone into the gate!&quot; he shouts, against Gandalf&#39;s protests.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You run back towards the gate.\" role=\"link\" tabindex=\"0\">You run back towards the gate.</a></p>",
		'passages': {
		},
	},
	'Merry is hit!': {
		'text': "<p>He falls into Pippin&#39;s arms, his body covered in arrows. He whispers something to Pippin before closing eyes, dead.</p>\n<p>Pippin cries, &quot;Merry! No! Not my Merry!&quot;</p>\n<p>Taking up his sword, he lunges into the battle.</p>\n<p>&quot;I&#39;ll kill all of you!&quot; he shrieks, as he disappears into the fray and vanishes into the sandstorm.</p>\n<p>Aragorn shouts, &quot;There&#39;s nothing we can do for them. We must retreat into the gate!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You run back towards the gate.\" role=\"link\" tabindex=\"0\">You run back towards the gate.</a></p>",
		'attributes': ["merryDead=1"],
		'passages': {
		},
	},
	'Merry is in the middle of it.': {
		'text': "<p>You lunge towards Merry and throw yourself on him. Your mythril vest protects you and him from the arrows.</p>\n<p>Aragorn begins to gag on the choking dust. &quot;We can&#39;t fight any longer. We must brave the void!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You run back towards the gate.\" role=\"link\" tabindex=\"0\">You run back towards the gate.</a></p>",
		'passages': {
		},
	},
	'You run back towards the gate.': {
		'text': "<p>&quot;No, we mustn&#39;t!&quot; Gandalf shouts, but Aragorn and Boromir force him into the void.</p>\n<p>You pass through the gateway and both the storm and battle cease to exist.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You have entered the Door of Night.\" role=\"link\" tabindex=\"0\">You have entered the Door of Night.</a></p>",
		'passages': {
		},
	},
	'retreat into the gateway': {
		'text': "<p>&quot;It&#39;s a trap!&quot; Gandalf shouts, but Aragorn and Boromir force him into the void.</p>\n<p>You pass through the gateway and both the storm and battle cease to exist.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You have entered the Door of Night.\" role=\"link\" tabindex=\"0\">You have entered the Door of Night.</a></p>",
		'passages': {
		},
	},
	'You have entered the Door of Night.': {
		'text': "<p>{if fellowship=3:{if merryPippinInMordor=0:{@fellowshipWeak=1}}}\n{if merryPippinInMordor=1:{if merryDead=0:{@merryPippinOutsideGate=1}}}\n{if merryPippinInMordor=1:{if merryDead=1:{@pippinOutsideGate=1}}}\n{if fellowship=2:{if glorfyHit=0:{@elvesFullPower=1}}}\n{if fellowship=2:{if glorfyHit=1:{@elvesHalfPower=1}}}</p>\n<p>&quot;Fools!&quot; Gandalf shouts in this darkness. He glances around and does a head count. He sees you, Aragorn, Gimli, Legolas and Boromir.</p>\n<p>Behind you, you see Saruman&#39;s army silently running towards you.{if merryPippinOutsideGate=1: Merry and Pippin bang against an invisible barrier on the other side of gate, crying to come inside.}{if fellowship=2: You see Arwen and Glorfy banging on an invisible barrier on the other side of the gate, shouting to come inside.}{if glorfyHit=1: Glorfy is bleeding profusely from his wound.} The gateway vanishes, leaving you trapped inside, separated from them.</p>\n<p>{if fellowshipWeak=1:&quot;We are safe from Saruman&#39;s forces,&quot;}{if pippinOutsideGate=1:&quot;Pippin is still out there,&quot;}{if merryPippinOutsideGate=1:&quot;There is nothing we can do for Merry and Pippin,&quot;}{if fellowship=2:&quot;There is nothing we can do for the elves,&quot;} Gandalf says. &quot;But we are in even greater danger in here. We have entered the Door of Night, a relic from Middle-Earth&#39;s last age. The gods of Middle-Earth used this doorway to seal away the greatest evil, and now we too are trapped within.&quot;</p>\n<p>You ask about Sam.</p>\n<p>&quot;By now, he&#39;s being taken to the Dark Lord,&quot; Gandalf says. &quot;But to <a class=\"squiffy-link link-section\" data-section=\"break out of here and save him\" role=\"link\" tabindex=\"0\">break out of here and save him</a> is beyond impossible in here. Now is the time to <a class=\"squiffy-link link-passage\" data-passage=\"despair\" role=\"link\" tabindex=\"0\">despair</a> and <a class=\"squiffy-link link-passage\" data-passage=\"abandon all hope\" role=\"link\" tabindex=\"0\">abandon all hope</a>.&quot;</p>",
		'passages': {
			'despair': {
				'text': "<p>You cry a little. This place brings out the worst in you.</p>",
			},
			'abandon all hope': {
				'text': "<p>You feel like absolute garbage. Sam is taken{if merryPippinOutsideGate=1:, Merry and Pippin are missing,}{if pippinOutsideGate=1:, Merry is dead, Pippin is missing,} and it&#39;s all your fault.</p>",
			},
		},
	},
	'break out of here and save him': {
		'text': "<p>You tell Gandalf you need to break out of here and save Sam.</p>\n<p>&quot;There is but one way out of the void,&quot; Gandalf says. &quot;We must pass through the Gates of Morning. But even if we find them before the nightmares of this realm find us, they will be sealed until dawn.&quot;</p>\n<p>He casts a spell with this staff and it lights a way ahead.</p>\n<p>&quot;You must follow me quickly,&quot; Gandalf says, &quot;before HE finds us first.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue64\" role=\"link\" tabindex=\"0\">You follow Gandalf into the darkness.</a></p>",
		'passages': {
		},
	},
	'_continue64': {
		'text': "<p>The void isn&#39;t like any cave or mine you&#39;ve seen. The halls look like a morbid catacomb of skeletal remains, with pillars and archways formed from skulls and other bones. Gandalf&#39;s staff causes wall torches to burn a bright blue as you pass. </p>\n<p>&quot;There should be stars,&quot; Gandalf mutters. &quot;The Door of Night should be an endless void of stars, not a wretched palace of death. This is the doing of HIM.&quot;</p>\n<p>&quot;Who?&quot; Gimli asks.</p>\n<p>&quot;Morgoth,&quot; Gandalf whispers. &quot;The Dark Lord of the First Age.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue65\" role=\"link\" tabindex=\"0\">A heavy wind echoes through the halls.</a></p>",
		'passages': {
		},
	},
	'_continue65': {
		'text': "<p>You brace yourself against the wind. Torchs flicker and a massive voice speaks through the corridors.</p>\n<p>&quot;YOU ARE MOST WELCOME TO MY ABODE,&quot; it greets you. &quot;YOU ARE ALSO MOST WELCOME... TO CHOOSE YOUR SUFFERING.&quot;</p>\n<p>Gandalf warns the Fellowship, &quot;<a class=\"squiffy-link link-passage\" data-passage=\"Empty your minds!\" role=\"link\" tabindex=\"0\">Empty your minds!</a> Give him nothing he asks!&quot;</p>\n<p>&quot;WHERE WILL YOUR SUFFERING BEGIN?&quot; the voice asks, &quot;DO YOU <a class=\"squiffy-link link-section\" data-section=\"FEAR THE PAST\" role=\"link\" tabindex=\"0\">FEAR THE PAST</a>? DO YOU <a class=\"squiffy-link link-section\" data-section=\"FEAR THE PRESENT\" role=\"link\" tabindex=\"0\">FEAR THE PRESENT</a>? OR DO YOU <a class=\"squiffy-link link-section\" data-section=\"FEAR WHAT'S YET-TO-COME\" role=\"link\" tabindex=\"0\">FEAR WHAT&#39;S YET-TO-COME</a>?&quot;</p>\n<p>Ignoring Gandalf&#39;s warning, Gimli is first to vanish.</p>",
		'passages': {
			'Empty your minds!': {
				'text': "<p>You attempt to clear your mind, but instead start fantasizing about pink oliphaunts and a giant marshmallow man. These bizarre fantasies give Morgoth pause, but you can only clear your mind for so long before it wanders again.</p>",
			},
		},
	},
	'FEAR THE PAST': {
		'text': "<p>You are the next to vanish.</p>\n<p>You find yourself in a new cave, sitting on a massive pile of gold. In fact, it isn&#39;t just one pile of gold; it&#39;s many. Gold, jewels, and treasure adorn this enormous cavernous chamber from wall to wall. </p>\n<p>You see something large moving beneath the golden coins ahead of you. It looks like a giant, red snake is slithering beneath the gold. But as you watch it, you see it&#39;s not a giant snake, but a tail belonging to something even bigger. You turn around see its owner.</p>\n<p>&quot;Hello, little thief,&quot; whispers Smaug the Magnificent. &quot;Welcome to your nightmare.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue66\" role=\"link\" tabindex=\"0\">You run.</a></p>",
		'passages': {
		},
	},
	'_continue66': {
		'text': "<p>This isn&#39;t your past. This is your Uncle Bilbo&#39;s. You&#39;ve been taken to the cave of Smaug, the dragon of Lonely Mountain, and put into your uncle&#39;s shoes. Now you must flee for your life before...</p>\n<p>&quot;I&#39;m not going to kill you,&quot; Smaug says. &quot;You&#39;re not worth the effort.&quot;</p>\n<p>You stop running and stumble over some gold trinkets. You look back at Smaug, his gargantuan frame taking up the room, and see he&#39;s just sitting there. He&#39;s not even looking at you.</p>\n<p>He sneers. &quot;Your uncle was worth the effort. But you? You&#39;re a nobody. You claim to <a class=\"squiffy-link link-section\" data-section=\"seek adventure\" role=\"link\" tabindex=\"0\">seek adventure</a>, yet thrive in your uncle&#39;s shadow. You&#39;ve no place in Middle-Earth beyond your hole in the ground. So just go ahead and <a class=\"squiffy-link link-section\" data-section=\"steal my gold\" role=\"link\" tabindex=\"0\">steal my gold</a>, thief. See if it brings you any worth.&quot;</p>",
		'passages': {
		},
	},
	'seek adventure': {
		'text': "<p>You stand up for yourself and approach Smaug, demanding he take that back. You are certainly worthy of being killed by a dragon. </p>\n<p>&quot;Hmmph,&quot; Smaug coughs. &quot;And what do I get out of killing you? A stain on my claw? Ashes on my gold? Certainly not a tale for the ages. You&#39;re no adventurer. You haven&#39;t even tried to <a class=\"squiffy-link link-section\" data-section=\"impress me\" role=\"link\" tabindex=\"0\">impress me</a> or <a class=\"squiffy-link link-section\" data-section=\"attack my weak spot\" role=\"link\" tabindex=\"0\">attack my weak spot</a> yet.&quot;</p>",
		'passages': {
		},
	},
	'impress me': {
		'text': "<p>You tell Smaug about all your amazing adventures thus far, and that it should be a privilege for him to kill you on the spot since you&#39;ve survived everything else thus far. He&#39;s not impressed.</p>\n<p>&quot;So you&#39;re an Underhill, a Ferry-Rider, and a Ring-Bearer? Sounds like your friends are worth killing, but not you. You can&#39;t get anywhere without your precious Fellowship. Maybe you should just <a class=\"squiffy-link link-section\" data-section=\"steal my gold\" role=\"link\" tabindex=\"0\">steal my gold</a> and run crying back to them.&quot;</p>\n<p>You&#39;re so irritated, you wish you had the courage to {if gandalfAngry&gt;5:<a class=\"squiffy-link link-section\" data-section=\"tell Smaug off\" role=\"link\" tabindex=\"0\">tell Smaug off</a>.}{if gandalfAngry&lt;6:tell Smaug off, but you haven&#39;t had enough practice standing up for yourself lately.}</p>",
		'passages': {
		},
	},
	'tell Smaug off': {
		'text': "<p>And you do. You&#39;ve had so much practice standing up to Gandalf recently that a dragon doesn&#39;t seem much different.</p>\n<p>You tell Smaug he&#39;s a pathetic wyrm who does nothing but sits on stolen gold in his mountain and doesn&#39;t contribute anything to society, and at least the Fellowship is better off having you carry the Ring, than anyone is having a smelly dragon in their backyard.</p>\n<p>Smaug seems offended, but also deeply cut. &quot;It seems you have some bite in you, after all, little one. Perhaps you are at least half the hobbit as your predecessors. But bite alone won&#39;t protect you against the likes of Morgoth.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue67\" role=\"link\" tabindex=\"0\">He reaches over and drops something at your feet.</a></p>",
		'passages': {
		},
	},
	'_continue67': {
		'text': "<p>You pick up a small gem. Upon claiming it, it vanishes into your soul.</p>\n<p>&quot;Consider this gem a blessing from the Valar,&quot; Smaug says. &quot;When you stand against Morgoth again, use its light to strengthen your own. And tell no one where you acquired it; I don&#39;t want anyone thinking I&#39;ve gone soft.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue68\" role=\"link\" tabindex=\"0\">You vanish from this cave and reawaken in the bone tunnel.</a></p>",
		'attributes': ["hasSilmaril = 1"],
		'passages': {
		},
	},
	'_continue68': {
		'text': "<p>The others are all here, surprised to see you awaken. As you stand, you seem taller to them. Even Gandalf takes a step back.</p>\n<p>&quot;You&#39;ve faced a nightmare and woken up taller, it seems,&quot; he says. &quot;You are the same Frodo, and yet... there is a light within you that wasn&#39;t there before. Morgoth has greatly failed to claim you, and we won&#39;t allow him another chance.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'passages': {
		},
	},
	'attack my weak spot': {
		'text': "<p>You grab a golden bow from the treasure trove with a golden arrow and aim it at Smaug&#39;s chest. You spy his missing scale Bilbo told you about, take aim and fire. </p>\n<p>You miss completely, but Smaug takes notice. He steps forward towards you.</p>\n<p>&quot;Try a little closer, thief,&quot; he growls. &quot;<a class=\"squiffy-link link-section\" data-section=\"Take one more shot\" role=\"link\" tabindex=\"0\">Take one more shot</a> at me and show me you&#39;re half the halfing your uncle was.&quot;</p>\n<p>{if hasSwordSting=1:You feel Sting humming in your sheath as Smaug draws near. It wants to <a class=\"squiffy-link link-section\" data-section=\"get more personal with Smaug\" role=\"link\" tabindex=\"0\">get more personal with Smaug</a>.}</p>",
		'passages': {
		},
	},
	'Take one more shot': {
		'text': "<p>You fire one last time. </p>\n<p>You miss again, the arrow glancing off Smaug&#39;s chest. </p>\n<p>&quot;Nice try, thief,&quot; Smaug says. &quot;You&#39;ve failed your test. But I suppose you&#39;re worth a snack at least.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue69\" role=\"link\" tabindex=\"0\">He charges up his fiery breath and engulfs you in flame.</a></p>",
		'passages': {
		},
	},
	'_continue69': {
		'text': "<p>You suddenly see Gandalf appear before you in a flash of light.</p>\n<p>&quot;Begone, foul nightmare!&quot; Gandalf shouts. You see the fire scorching his hands as his staff deflects the flames.</p>\n<p>The dragon disappears, as do you and Gandalf from the cave.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue70\" role=\"link\" tabindex=\"0\">You are back in the bone tunnel.</a></p>",
		'passages': {
		},
	},
	'_continue70': {
		'text': "<p>Aragoron, Boromir, Gimli, and Legolas are all here, worse for wear. Gandalf clasps his burnt hands.</p>\n<p>&quot;I have given the last of my strength to pull you from Morgoth&#39;s nightmare,&quot; Gandalf says. &quot;Let us pray he does not ensnare us again.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["failedDream = 1"],
		'passages': {
		},
	},
	'get more personal with Smaug': {
		'text': "<p>You drop the bow, pull your uncle&#39;s sword from its sheath, and lunge at the dragon. Smaug doesn&#39;t expect your attack as you plunge the blade into his chest.</p>\n<p>The wretched wyrm falls and dies on his mountain of gold.</p>\n<p>You pull your blade from his chest and the cave vanishes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue71\" role=\"link\" tabindex=\"0\">You find yourself suddenly surrounded by the ghosts of hobbits.</a></p>",
		'passages': {
		},
	},
	'_continue71': {
		'text': "<p>You recognize many of them from old paintings, but don&#39;t know their names. {if bilboDead=1:Bilbo is among them, more cheery than he should be among relatives. }One hobbit stands taller above the rest. He approaches you and places a hand on your shoulder.</p>\n<p>&quot;Gandalf chooses us for our humble beginnings, Frodo,&quot; the hobbit tells you. &quot;The greatness we share is earned and passed on, as Bilbo did to you, and all of Gandalf&#39;s companions did before him. And now we pass something more to you - just a little thing I picked up in Bree. With it, you will escape the Door of Night and destroy the Ring of Doom. Good luck.&quot;</p>\n<p>He vanishes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue72\" role=\"link\" tabindex=\"0\">You awaken in the bone tunnel, your nightmare is over.</a></p>",
		'passages': {
		},
	},
	'_continue72': {
		'text': "<p>Aragorn, Legolas, Gimli, Boromir, and Gandalf are all here, having awakened from their sleeps as well. Gimli&#39;s eyes light up at the sight of you. </p>\n<p>&quot;Mythil mirror armour!&quot; he exclaims, eyeing your open vest. &quot;Where in blazes did you get that all of a sudden.&quot;</p>\n<p>For defeating Smaug, the hobbit ghosts have upgraded your mythril vest into mythril mirror armour, shinier and stronger than before!</p>\n<p>&quot;With that, you can deflect magical attacks!&quot; Gimli exclaims. &quot;We&#39;ll defeat Morgoth with that for sure!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["hasMirrorArmour = 1"],
		'passages': {
		},
	},
	'steal my gold': {
		'text': "<p>Smaug&#39;s words cut you deeply. You&#39;re no ordinary hobbit! You can absolutely steal a dragon&#39;s gold, just like uncle Bilbo!</p>\n<p>You grab a handful of coins and flee the cave, crying. </p>\n<p>Returning to the Shire, you settle back into Bag End, live a life of luxury, and curl up waiting to die.</p>\n<p>You&#39;re totally awesome, you keep telling yourself. Just like Bilbo. You got the gold, which means you win at life. There&#39;s nothing beyond this.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue73\" role=\"link\" tabindex=\"0\">You get old and sad.</a></p>",
		'passages': {
		},
	},
	'_continue73': {
		'text': "<p>Nobody wants to be your friend. You are a decrepit old hobbit, unloved and unwanted. Middle-Earth burned down around you long ago, but you don&#39;t care, because you already found your self-worth. </p>\n<p>You die in front of the fireplace one night and wild dogs eat your body.</p>\n<p>THE END</p>\n<p>&quot;WAKE UP, FRODO!&quot; Gandalf shouts, &quot;WAKE UP!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue74\" role=\"link\" tabindex=\"0\">A jolt awakens you.</a></p>",
		'passages': {
		},
	},
	'_continue74': {
		'text': "<p>You are back in the bone tunnel. Everyone else is here. Aragorn is doing CPR on you while Gandalf zaps you with his staff, trying to kickstart your heart. You cough and sit up. Gandalf sits down, tired and worn.</p>\n<p>&quot;Morgoth tried to claim us in our nightmares,&quot; he says. &quot;He almost claimed you, but I used the last of my power to bring you back. We mustn&#39;t let him try to claim any of us again.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["failedDream = 1"],
		'passages': {
		},
	},
	'FEAR THE PRESENT': {
		'text': "<p>You are the next to vanish.</p>\n<p>You are back outside. The Mountains of Ash are behind you. Mt. Doom is in the distance. You appear to be outside the void once more, but you believe this might be an illusion.</p>\n<p>You call out to the Fellowship once more and no one answers.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue75\" role=\"link\" tabindex=\"0\">Nowhere else to go, you begin towards Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue75': {
		'text': "<p>The Ring weighs heavily on you once more as you climb the crags of the mountain face. You need help more than ever, and the Ring keeps promising you the strength to climb if you&#39;ll <a class=\"squiffy-link link-section\" data-section=\"just wear it again\" role=\"link\" tabindex=\"0\">just wear it again</a>.</p>",
		'passages': {
		},
	},
	'just wear it again': {
		'text': "<p>But the Ring is already on you, coiled around your skin like a large snake, strangling you. Your arms and legs are bound as the Ring pulls you down the mountain away from the fires. </p>\n<p>You roll down the hill, calling for help, and help arrives.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue76\" role=\"link\" tabindex=\"0\">Boromir catches you.</a></p>",
		'passages': {
		},
	},
	'_continue76': {
		'text': "<p>{if boromirTriedToTakeRing=0:&quot;Is this your nightmare?&quot; Boromir asks, looking down on your bound frame. &quot;To be forever weighed down by this Ring over a task so simple? Gandalf knows not what he&#39;s doing. We should&#39;ve taken this Ring to Gonder in the first place.{if boromirRemembers=1: You thought so yourself once.} And maybe if you&#39;re no longer bound to it, the Ring will go to someone else for a change.&quot;}</p>\n<p>{if boromirTriedToTakeRing=1:&quot;Here we are again, Frodo,&quot; Boromir says, looking down on your bound frame. &quot;Do you enjoy being forever weighed down by this Ring over a task so simple? Gandalf knows not what he&#39;s doing. You should&#39;ve let me take this Ring to Gonder when I came for it. And perhaps if you&#39;re no longer bound to it, the Ring will go to someone else for a change?&quot;}</p>\n<p>He raises his sword and strikes down at you. You roll out of the way as he stabs into the dirt.</p>\n<p>&quot;Come on, Frodo!&quot; he shouts, attacking again, &quot;Surrender the Ring! Let your suffering end!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue77\" role=\"link\" tabindex=\"0\">His sword is parried by another sword.</a></p>",
		'passages': {
		},
	},
	'_continue77': {
		'text': "<p>A second Boromir appears.</p>\n<p>{if boromirTriedToTakeRing=0:&quot;Are you MY nightmare?&quot; the second Boromir asks the first. &quot;Time and time again, I&#39;ve been tempted to take the Ring from Frodo! And now I must see my betrayal given form?&quot;}</p>\n<p>{if boromirTriedToTakeRing=0:&quot;This doesn&#39;t have to be your nightmare,&quot; the first Boromir tells him. &quot;Take the Ring now, while Frodo is down. Join me and we will save Gondor.&quot;}</p>\n<p>{if boromirTriedToTakeRing=0:Boromir brandishes his blade once more and says, &quot;Now that I&#39;ve seen my betrayal... I have no desire to pursue it. Only to kill it.&quot;}</p>\n<p>{if boromirTriedToTakeRing=0:<a class=\"squiffy-link link-section\" data-section=\"The two Boromirs clash.\" role=\"link\" tabindex=\"0\">The two Boromirs clash.</a>}</p>\n<p>{if boromirTriedToTakeRing=1:&quot;Are you MY nightmare?&quot; the second Boromir asks the first. &quot;You are my failure given form, betraying a friend yet again. I will not let you take the Ring! Not again!&quot;}</p>\n<p>{if boromirTriedToTakeRing=1:The first one laughs. &quot;I&#39;ve seen your strength falter. Your failure is who you are. And no one will forgive you for it. Join me and we will save Gondor together.&quot;}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=0:<a class=\"squiffy-link link-section\" data-section=\"Boromir reconsiders the offer.\" role=\"link\" tabindex=\"0\">Boromir reconsiders the offer.</a>}}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=1:<a class=\"squiffy-link link-section\" data-section=\"Boromir has already decided.\" role=\"link\" tabindex=\"0\">Boromir has already decided.</a>}}</p>",
		'passages': {
		},
	},
	'The two Boromirs clash.': {
		'text': "<p>You watch as they fight and your Boromir gets several cuts and bruises in the bout. But ultimately, he succeeds in skewering his double. The double vanishes, leaving only one Boromir.</p>\n<p>You and the Ring are suddenly back to normal.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue78\" role=\"link\" tabindex=\"0\">Mt. Doom vanishes and you are back in the bone tunnel.</a></p>",
		'passages': {
		},
	},
	'_continue78': {
		'text': "<p>You see Aragorn, Gimli, Legolas, and Gandalf waiting for you. Boromir awakens next to you.</p>\n<p>&quot;It seems you have also broken free of Morgoth&#39;s nightmare,&quot; Aragorn says to Boromir.</p>\n<p>&quot;Yes, and what I saw will change nothing,&quot; Boromir says. &quot;I will continue to serve as steward to Frodo&#39;s quest, but I will distance myself from him, lest the Ring tempt me again.&quot;</p>\n<p>&quot;Morgoth came for us once, but he will not get another chance,&quot; Gandalf says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["boromirWonDream = 1"],
		'passages': {
		},
	},
	'Boromir reconsiders the offer.': {
		'text': "<p>He doesn&#39;t remember you ever forgiving him for his actions on the beach. And his double is right. Why should he believe in the Fellowship if the Fellowship doesn&#39;t believe in him?</p>\n<p>&quot;I&#39;m sorry, Frodo,&quot; he says, aiming his sword towards you. &quot;It seems my redemption was not meant to be.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue79\" role=\"link\" tabindex=\"0\">He attacks you.</a></p>",
		'passages': {
		},
	},
	'_continue79': {
		'text': "<p>Aragorn runs in and deflects his blow.</p>\n<p>&quot;Let me kill him!&quot; Boromir shouts. &quot;It&#39;s the only way to save us all!&quot;</p>\n<p>He lunges forward again and falls on Aragorn&#39;s blade.</p>\n<p>Boromir falls over DEAD. His double disappears.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue80\" role=\"link\" tabindex=\"0\">Aragorn helps you up.</a></p>",
		'attributes': ["boromirDead = 1","FellowshipKilledInMordor+=1"],
		'passages': {
		},
	},
	'_continue80': {
		'text': "<p>&quot;This was my nightmare,&quot; Aragorn says, as the Ring is once again upon your chain and no longer binding you. &quot;To be forced to choice between duty and a friend. To watch our Fellowship fail.&quot;</p>\n<p>You thank him for saving you, but the damage is done. Aragorn is heart-broken and mortified that he killed Boromir. He just wants time to himself.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue81\" role=\"link\" tabindex=\"0\">Mt. Doom vanishes and you are back in the bone tunnel.</a></p>",
		'passages': {
		},
	},
	'_continue81': {
		'text': "<p>Boromir&#39;s body is at your feet. Gandalf, Gimli and Legolas are also here, just as surprised to see you.</p>\n<p>&quot;This is Morgoth&#39;s doing,&quot; Gandalf says. &quot;We mustn&#39;t give him another chance.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["failedDream = 1"],
		'passages': {
		},
	},
	'Boromir has already decided.': {
		'text': "<p>He remembers you already forgave him, and this double isn&#39;t worth listening to. He strikes his double down quickly, without warning, and helps you up.</p>\n<p>&quot;I will not break the Fellowship a second time,&quot; he tells you as the Ring uncoils, shrinks down, and returns to your chain. &quot;We will reach Mt. Doom together.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue82\" role=\"link\" tabindex=\"0\">Mt. Doom vanishes and you are back in the bone tunnel.</a></p>",
		'passages': {
		},
	},
	'_continue82': {
		'text': "<p>You see Aragorn, Gimli, Legolas, and Gandalf waiting for you.</p>\n<p>&quot;It seems you have also broken free of Morgoth&#39;s nightmare,&quot; Aragorn says. &quot;Boromir, you are a true friend and worthy ally.&quot;</p>\n<p>Everyone congratulates Boromir for his well-earned redemption. Boromir will now be completely loyal to the Fellowship.</p>\n<p>&quot;Morgoth came for us once, but he will not get another chance,&quot; Gandalf says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["boromirRedeemed = 1"],
		'passages': {
		},
	},
	'FEAR WHAT\'S YET-TO-COME': {
		'text': "<p>You are the next to vanish.</p>\n<p>You are back in the Shire. The town square to be precise. And everything&#39;s on fire.</p>\n<p>You realize you are in the vision you once saw in Galadriel&#39;s pool. You&#39;ve failed to destroy the Ring, and now the forces of Mordor have conquered the Shire. You watch as your friends&#39; homes burn around you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue83\" role=\"link\" tabindex=\"0\">You flee to the safety of Bag End.</a></p>",
		'passages': {
		},
	},
	'_continue83': {
		'text': "<p>But inside your own home, you face an unusual encounter. A strange bearded man in white robes is sitting in your lounger, enjoying your tea. From the looks of his staff, he is a wizard like Gandalf.</p>\n<p>&quot;Oh, I&#39;m sorry, is this your home?&quot; he muses. &quot;Allow me to introduce myself; Saruman the Wise, and I believe you are Frodo Baggins... at MY service.&quot;</p>\n<p>He snaps his fingers and you fall at his feet. He puts them up on your back. You are unable to move.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue84\" role=\"link\" tabindex=\"0\">He puffs his pipe and enjoys your misery.</a></p>",
		'passages': {
		},
	},
	'_continue84': {
		'text': "<p>&quot;After you failed to destroy the Ring, it was quite easy for the forces of Isengard to overwhelm Rohan while Sauron conquered Gondor. And then I learned of this quaint little town and thought I&#39;d retire here. I had to dispose of the locals, of course.&quot;</p>\n<p>Outside, you hear the screams of your fellow hobbits. You want to break free and <a class=\"squiffy-link link-section\" data-section=\"try to save them\" role=\"link\" tabindex=\"0\">try to save them</a>, but you might have to <a class=\"squiffy-link link-section\" data-section=\"deal with Saruman\" role=\"link\" tabindex=\"0\">deal with Saruman</a> first.</p>",
		'passages': {
		},
	},
	'try to save them': {
		'text': "<p>You force yourself out from under Saruman&#39;s feet and run to the door. But Saruman&#39;s magic whisks you into the air. You shrink down and find yourself trapped in Bilbo&#39;s mother&#39;s glory box. The lid slams shut, leaving you in darkness.</p>\n<p>&quot;Let us consider themes, dear Frodo,&quot; Saruman says. &quot;In this nightmare, you must face your fear of failure. Therefore, failure is inevitable, no matter what you choose, because it is what you fear. So please, <a class=\"squiffy-link link-section\" data-section=\"continue fighting to my delight\" role=\"link\" tabindex=\"0\">continue fighting to my delight</a>, lest you&#39;re ready to <a class=\"squiffy-link link-section\" data-section=\"embrace your failure entirely\" role=\"link\" tabindex=\"0\">embrace your failure entirely</a>.&quot;</p>",
		'passages': {
		},
	},
	'continue fighting to my delight': {
		'text': "<p>You kick and scream against the walls of the box, demanding to be let out. Saruman&#39;s laugh drowns out your screams.</p>\n<p>The Ring relishes your weakness.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You never stop fighting.\" role=\"link\" tabindex=\"0\">You never stop fighting.</a></p>",
		'passages': {
		},
	},
	'embrace your failure entirely': {
		'text': "<p>Saruman&#39;s right. You&#39;ve been so desperate to succeed, you haven&#39;t allowed yourself to rest. Bad things happen and sometimes you can&#39;t do anything to stop it. It doesn&#39;t mean you shouldn&#39;t try, but you can&#39;t save Middle-Earth if all you do is fear the worst.</p>\n<p>&quot;Are you ok in there?&quot; Saruman asks, noticing you&#39;re quiet. He opens the box and peers inside. His beard falls in, begging you to <a class=\"squiffy-link link-section\" data-section=\"yank it\" role=\"link\" tabindex=\"0\">yank it</a>.</p>",
		'passages': {
		},
	},
	'yank it': {
		'text': "<p>You jump on his beard and pull his head forward, banging his head on Bilbo&#39;s mother&#39;s glory box. Then you hang on tight as he stumbles around Bag End, swinging you around.</p>\n<p>He crashes into furniture, breaks dishware, and ruins all your nice things. You swing precariously from his beard, knowing this can&#39;t end well, but embrace wherever it might lead.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"He bangs his head on the chandelier and falls backwards.\" role=\"link\" tabindex=\"0\">He bangs his head on the chandelier and falls backwards.</a></p>",
		'passages': {
		},
	},
	'He bangs his head on the chandelier and falls backwards.': {
		'text': "<p>His staff falls from his hands and misfires a magic spell that bounces around your home. The spell ignites and explodes. You are thrown through the window.</p>\n<p>You land safely in Sam&#39;s well-tended garden and watch as Bag End erupts in a pillar of fire, destroying Saruman with it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue85\" role=\"link\" tabindex=\"0\">You awaken in the bone tunnel.</a></p>",
		'attributes': ["defeatedSaruman = 1"],
		'passages': {
		},
	},
	'_continue85': {
		'text': "<p>The Fellowship is surprised to see you awake.</p>\n<p>&quot;You&#39;ve survived Morgoth&#39;s nightmare encounter,&quot; Gandalf says. &quot;I certainly hope you learned something from it that we can use.&quot;</p>\n<p>You tell Gandalf that you will no longer fear failure in the face of death, and will yank as many wizard beards as it takes to prove it.</p>\n<p>Gandalf and his beard take a step back from you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'passages': {
		},
	},
	'deal with Saruman': {
		'text': "<p>You break free of his spell, grab a fire poker from the mantle and attack the wizard. Saruman easily tosses you into the ceiling with a snap of his fingers.</p>\n<p>&quot;Let us consider themes, dear Frodo,&quot; Saruman says. &quot;In this nightmare, you must face your fear of failure. Therefore, failure is inevitable, no matter what you choose, because it is what you fear. So please, <a class=\"squiffy-link link-section\" data-section=\"take as many swings at me\" role=\"link\" tabindex=\"0\">take as many swings at me</a> as you like lest you&#39;re ready to embrace your failure and <a class=\"squiffy-link link-section\" data-section=\"throw another log\" role=\"link\" tabindex=\"0\">throw another log</a> on the fire for me.&quot;</p>",
		'passages': {
		},
	},
	'take as many swings at me': {
		'text': "<p>You dive at Saruman again and again, trying to kill the wizard. He continues to laugh as he magically throws you around the room, slamming you into all manner of belonging. Your homeware falls to pieces to Saruman&#39;s delight.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You never stop fighting.\" role=\"link\" tabindex=\"0\">You never stop fighting.</a></p>",
		'passages': {
		},
	},
	'throw another log': {
		'text': "<p>Saruman&#39;s right. You&#39;ve been so desperate to succeed, you haven&#39;t allowed yourself to rest. Bad things happen and sometimes you can&#39;t do anything to stop it. It doesn&#39;t mean you shouldn&#39;t try, but you can&#39;t save Middle-Earth if all you do is fear the worst.</p>\n<p>Now that you&#39;ve had time to meditate, you throw another log on the fire.</p>\n<p>And then you take that flaming log and <a class=\"squiffy-link link-section\" data-section=\"throw it on the floor\" role=\"link\" tabindex=\"0\">throw it on the floor</a>.</p>",
		'passages': {
		},
	},
	'throw it on the floor': {
		'text': "<p>&quot;What are you doing?&quot; Saruman shouts as the room catches fire.</p>\n<p>You tell him you&#39;re trying to fail, by burning down your own home.</p>\n<p>As the fire spreads at your feet, Saruman runs to the door, but doesn&#39;t watch for the low ceiling.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"He bangs his head on the chandelier and falls backwards.\" role=\"link\" tabindex=\"0\">He bangs his head on the chandelier and falls backwards.</a></p>",
		'passages': {
		},
	},
	'You never stop fighting.': {
		'text': "<p>In time, you tire of fighting, but keep struggling against the nightmare. You don&#39;t know where you are anymore. You simply disappear into your own denial, never accepting failure as an option. Saruman continues laughing.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue86\" role=\"link\" tabindex=\"0\">The Ring whispers for you to put it on for old time&#39;s sake</a></p>",
		'passages': {
		},
	},
	'_continue86': {
		'text': "<p>Suddenly, you&#39;re back in the bone tunnel and the whole Fellowship is fighting you as you struggle on the ground. Gandalf is trying hard to force your hands apart, shouting, &quot;Don&#39;t let him wear the Ring!&quot;</p>\n<p>You backhand him and the Ring strikes his face. Its magic stuns him, but snaps you out of your nightmare. You hide the Ring away.</p>\n<p>&quot;Whatever nightmare you faced, its power has sapped me of my strength,&quot; Gandalf says. &quot;We cannot allow Morgoth to try and claim us again.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The voice returns.\" role=\"link\" tabindex=\"0\">The voice returns.</a></p>",
		'attributes': ["failedDream = 1"],
		'passages': {
		},
	},
	'The voice returns.': {
		'text': "<p>&quot;THEN COME FORWARD AND FACE ME,&quot; he echoes.</p>\n<p>Bright blue torches further down the tunnel illuminate your path into the next large chamber.</p>\n<p>Gandalf readies his staff. &quot;It seems Morgoth is no longer playing with us. Be on your guard.&quot;</p>\n<p>You follow the Fellowship down the tunnel and <a class=\"squiffy-link link-section\" data-section=\"enter a large throne room\" role=\"link\" tabindex=\"0\">enter a large throne room</a>.</p>",
		'passages': {
		},
	},
	'enter a large throne room': {
		'text': "<p>The floor of bones encircles the room, rounds up over the walls and returns over the ceiling towards an enormous black throne in the center of this chamber.</p>\n<p>Bound to the throne by chains is a black, living corpse. His darkened flesh is rotten down to the bone and there is an iron crown around his neck, adorned by three glowing gems.</p>\n<p>But most startling are his eyes. He has two purple glowing orbs where his eyes should be. They are the same as the orb on the gateway coming in.</p>\n<p>&quot;He has Palantirs for eyes,&quot; Gandalf says. &quot;There&#39;s no telling what he sees.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue87\" role=\"link\" tabindex=\"0\">Morgoth speaks.</a></p>",
		'passages': {
		},
	},
	'_continue87': {
		'text': "<p>&quot;For my centuries upon this throne, I foresaw your arrival, wizard,&quot; he growls. &quot;I foresaw all of Middle-Earth&#39;s destiny and each of your own. I foresaw Mordor rising, the Ring entering my domain, and the little hobbit who would carry it. But you need not fear me taking it, for I am host to a greater power.&quot;</p>\n<p>Morgoth gestures to the crown around his neck.</p>\n<p>&quot;I will allow you to leave through the Gates of Morning, but at a price,&quot; he points at Gandalf. &quot;The son of the Maiar must stay.&quot;</p>\n<p>Aragorn waves his sword around. &quot;You&#39;ll take none of us!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue88\" role=\"link\" tabindex=\"0\">Morgoth shoots lightning out of his eyes at Aragorn.</a></p>",
		'passages': {
		},
	},
	'_continue88': {
		'text': "<p>Aragorn is stunned and falls backwards into Gimli and Legolas&#39; arms.</p>\n<p>Morgoth waves another hand and a door opens in the wall to his right. A bright burning ray of sunlight pours through.</p>\n<p>&quot;This is your path back to Mordor to destroy the Ring,&quot; he says. He glares menacingly at Gandalf. &quot;I have no desire for the Ring to remain in this domain, but leave the wizard with me. Ask nothing of my intentions.{if boromirDead=1: Or you&#39;ll suffer the same fate as your companion, Boromir.}&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue89\" role=\"link\" tabindex=\"0\">Gandalf readies his staff and nods to you.</a></p>",
		'passages': {
		},
	},
	'_continue89': {
		'text': "<p>&quot;Do as he says,&quot; Gandalf tells you. &quot;This is the business of the Maiar. They bound Morgoth to this realm, and while I do not have the power to release him, I&#39;m certain he lusts for retribution. <a class=\"squiffy-link link-section\" data-section=\"Take the Fellowship and leave me\" role=\"link\" tabindex=\"0\">Take the Fellowship and leave me</a>, Frodo.&quot;</p>\n<p>&quot;No, you mustn&#39;t!&quot; Legolas shouts. &quot;We&#39;ll fight him together!&quot;</p>\n<p>&quot;This is an enemy beyond all of Middle-Earth,&quot; Gandalf says. &quot;You must leave through the gate. I will see to it Morgoth holds no further sway over this war.&quot;</p>\n<p>Your hand reaches into your vest and clutches the Light of Galadriel. To {if hasSilmaril=0:<a class=\"squiffy-link link-passage\" data-passage=\"use the Light against Morgoth\" role=\"link\" tabindex=\"0\">use the Light against Morgoth</a>}{if hasSilmaril=1:<a class=\"squiffy-link link-section\" data-section=\"use this Light against Morgoth\" role=\"link\" tabindex=\"0\">use this Light against Morgoth</a>} might be your only chance against him. {if failedDream=1:Otherwise, you are too winded from Morgoth&#39;s nightmare to think of a clear way to save Gandalf.}</p>\n<p>{if hasMirrorArmour=1:But you remember your gift from the hobbit spirits and wonder if you can <a class=\"squiffy-link link-section\" data-section=\"use it against Morgoth's power.\" role=\"link\" tabindex=\"0\">use it against Morgoth&#39;s power.</a>}</p>\n<p>{if boromirWonDream=1:You notice <a class=\"squiffy-link link-section\" data-section=\"Boromir is eager to confront Morgoth himself.\" role=\"link\" tabindex=\"0\">Boromir is eager to confront Morgoth himself.</a>}</p>\n<p>{if boromirRedeemed=1:You notice <a class=\"squiffy-link link-section\" data-section=\"Boromir is eager to confront Morgoth.\" role=\"link\" tabindex=\"0\">Boromir is eager to confront Morgoth.</a>}</p>\n<p>{if defeatedSaruman=1:But then you remember your nightmare in the burning Shire and wonder if you should <a class=\"squiffy-link link-section\" data-section=\"show Morgoth what you learned\" role=\"link\" tabindex=\"0\">show Morgoth what you learned</a>.}</p>",
		'passages': {
			'use the Light against Morgoth': {
				'text': "<p>You whip out the Light, uncap it, and blast it in Morgoth&#39;s face. He is startled, but underwhelmed. The Light&#39;s power isn&#39;t strong enough to harm him.</p>\n<p>&quot;What a charming torch,&quot; he snarls. &quot;Had one just like that when I was little.&quot;</p>\n<p>It seems Galadriel&#39;s Light by itself isn&#39;t strong enough to stop Morgoth.</p>",
			},
		},
	},
	'use this Light against Morgoth': {
		'text': "<p>You whip out the Light, uncap it, and blast it in Morgoth&#39;s face. He screams as the Light blazes in his face like an exploding star. Even Gandalf and the others are surprised at the sight of it. </p>\n<p>&quot;How?!?&quot; Morgoth screams. &quot;That is pure First Age power! That is... that is MY power! Who gave that to you? WHO?!?&quot;</p>\n<p>You tell the others to hurry on. Gandalf and the others run to the Gate of Morning. Morgoth, blinded by light, tries to zap them with lightning, but his arcs scatter.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue90\" role=\"link\" tabindex=\"0\">You smash the phial at his feet.</a></p>",
		'passages': {
		},
	},
	'_continue90': {
		'text': "<p>A small vision of Smaug erupts from the phial. The dragon soars around Morgoth, blasting him with flames. Morgoth is unable to defend himself.</p>\n<p>&quot;Smaug, you ungrateful traitor!&quot; he shouts. &quot;You were always my least favourite pet!&quot;</p>\n<p>As he struggles against the flame, <a class=\"squiffy-link link-section\" data-section=\"you rush into the Gates of Morning\" role=\"link\" tabindex=\"0\">you rush into the Gates of Morning</a>.</p>",
		'attributes': ["defeatedMorgoth = 1"],
		'passages': {
		},
	},
	'use it against Morgoth\'s power.': {
		'text': "<p>You step forward, grabbing Morgoth&#39;s attention, and speak very unflattering things to him.</p>\n<p>&quot;Foolish hobbit,&quot; he growls, his eyes flaring with light, &quot;Perhaps you want another taste of my power???&quot;</p>\n<p>Lightning surges towards you. You open your vest to reveal your mythril mirror armour just as the lightning strikes. The lightning is immediately reflected back towards Morgoth. He screams as his flesh sizzles.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue91\" role=\"link\" tabindex=\"0\">Then an unfortunate side-effect occurs.</a></p>",
		'passages': {
		},
	},
	'_continue91': {
		'text': "<p>His Palantir eyes, gazing into your mirror armour, reflect everything he sees back into them. His ability to see all space/time has now been weaponized and he sees the entire universe, reflecting infinitely (and painfully) though his mind.</p>\n<p>He sees you and your infinite timelines. He sees the many choices and paths that could&#39;ve brought you here, and didn&#39;t bet he was on the one timeline where he fries his own brain with magic hobbit armour.</p>\n<p>As he screams in agony, Gandalf ushers everyone to run. Closing your vest, <a class=\"squiffy-link link-section\" data-section=\"you rush into the Gates of Morning\" role=\"link\" tabindex=\"0\">you rush into the Gates of Morning</a>.</p>",
		'attributes': ["defeatedMorgoth = 1"],
		'passages': {
		},
	},
	'Boromir is eager to confront Morgoth himself.': {
		'text': "<p>As you step aside for Boromir, he shouts to Morgoth, &quot;If you want Gandalf, you&#39;ll have to go through me!&quot;</p>\n<p>&quot;That is acceptable,&quot; Morgoth says as lightning fires from his eyes towards Boromir. Boromir braces himself against Morgoth&#39;s attack with his shield, but the power is too great and he falls to one knee.</p>\n<p>&quot;No!&quot; Legolas shouts as he fires a pair of arrows at Morgoth&#39;s eyes. The arrows glance off the Palantirs. Morgoth gazes towards the elf, but Boromir throws himself in Morgoth&#39;s line of sight, continuing to take the blast of lightning. </p>\n<p>The heat from his shield is intense and you can see his hand fusing to its handle. Boromir slowly begins moving towards Morgoth, attracting the lightning with his sword and shield. His skin crackles and his clothes burn under Morgoth&#39;s intense heat.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue92\" role=\"link\" tabindex=\"0\">Gandalf fires a powerful blast at Morgoth.</a></p>",
		'passages': {
		},
	},
	'_continue92': {
		'text': "<p>While Morgoth is stunned, you all try to help Boromir, but he is beyond saving. The lightning has cooked him alive from the inside.</p>\n<p>&quot;Hurry to the gates,&quot; Boromir says. &quot;I know now this is my destiny. My role is not to protect the Ring, but to protect Gondor, and all Middle-Earth with it!&quot;</p>\n<p>He charges at Morgoth, and with the last of his strength, leaps up and stabs the Dark Lord upwards through the skull. This doesn&#39;t kill Morgoth, but it does enable the Fellowship to flee. As you run, you see Boromir&#39;s body burn up into ash in the face of Morgoth&#39;s power.</p>\n<p>You bid Boromir farewell as you <a class=\"squiffy-link link-section\" data-section=\"you rush into the Gates of Morning\" role=\"link\" tabindex=\"0\">you rush into the Gates of Morning</a>.</p>",
		'attributes': ["defeatedMorgoth = 1","boromirDead = 1","boromirSacrificed = 1","FellowshipKilledInMordor+=1"],
		'passages': {
		},
	},
	'Boromir is eager to confront Morgoth.': {
		'text': "<p>As you step aside for Boromir, he shouts to Morgoth, &quot;If you want Gandalf, you&#39;ll have to go through me!&quot;</p>\n<p>You stand beside him, as do the rest of the Fellowship.</p>\n<p>&quot;You must go through all of us,&quot; Gimli says.</p>\n<p>&quot;Very well,&quot; Morgoth says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue93\" role=\"link\" tabindex=\"0\">He unleashes chain lightning from his eyes.</a></p>",
		'passages': {
		},
	},
	'_continue93': {
		'text': "<p>Aragorn and Boromir hold their shields up together to block the lightning. Legolas quickly fires arrows into Morgoth&#39;s eye sockets, while Gandalf blasts him with a powerful blizzard spell to blind him. With his friends by his side, Boromir lunges forward, grabbing the chains binding Morgoth to his throne, and tightens them further. Morgoth is stunned and unable to move.</p>\n<p>Aragorn grabs Gimli and throws him at Morgoth, axe-first. Gimli&#39;s axe swings up against the Dark Lord&#39;s neck, driving the iron crown upwards through Morgoth&#39;s face. It&#39;s a gruesome sight to see.</p>\n<p>As Morgoth struggles to regain composure, Gandalf motions everyone to follow him. Gathering yourself, <a class=\"squiffy-link link-section\" data-section=\"you rush into the Gates of Morning\" role=\"link\" tabindex=\"0\">you rush into the Gates of Morning</a>.</p>",
		'attributes': ["defeatedMorgoth = 1"],
		'passages': {
		},
	},
	'show Morgoth what you learned': {
		'text': "<p>You step forward to say goodbye to Gandalf... and then abruptedly push the wizard towards Morgoth.</p>\n<p>He drops his staff. It misfires and sends a magical firebolt bouncing around the room. Everyone ducks as it smashes off the walls, shattering bones, and tears through pillars.</p>\n<p>The bolt hits a lode-bearing stone and destroys a massive section of the room.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue94\" role=\"link\" tabindex=\"0\">The chamber begins to crumble.</a></p>",
		'passages': {
		},
	},
	'_continue94': {
		'text': "<p>As the bone walls fall away, you see an empty void beyond them full of stars.</p>\n<p>&quot;What&#39;s going on?&quot; Morgoth asks, craning his head wildly. &quot;What did you do?!&quot;</p>\n<p>Gandalf regains his staff and ushers everyone towards the gate.</p>\n<p>As <a class=\"squiffy-link link-section\" data-section=\"you rush into the Gates of Morning\" role=\"link\" tabindex=\"0\">you rush into the Gates of Morning</a>, the ceiling caves in, burying Morgoth and casting him even further into the darkness. He disappears into the void, completely confused about what just happened.</p>",
		'attributes': ["defeatedMorgoth = 1"],
		'passages': {
		},
	},
	'Take the Fellowship and leave me': {
		'text': "<p>You bid farewell to Gandalf as you hurry into the Gates of Morning and leave the wizard to deal with the Dark Lord.</p>\n<p>&quot;Get ready to enjoy eternity with me,&quot; Morgoth tells him. &quot;I&#39;m going to make you pay for everything the Maiar did to me.&quot;</p>\n<p>&quot;Don&#39;t assume I&#39;m trapped in here with you,&quot; Gandalf says. &quot;You are trapped in here with me.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue95\" role=\"link\" tabindex=\"0\">He strikes his staff against the ground.</a></p>",
		'passages': {
		},
	},
	'_continue95': {
		'text': "<p>The cave rumbles and begins to crumble.</p>\n<p>Morgoth blasts lightning from his eyes towards Gandalf. Gandalf furiously blocks it with his staff and holds his ground as the room collapses.</p>\n<p>&quot;Return to the void, foul spawn!&quot; Gandalf shouts as he uses the last of his magic to explode the floor once more. The jolt shakes the Palantirs out of Morgoth&#39;s eyes, blinding him.</p>\n<p>Both he and Morgoth fall through the chamber floor and disappear into the endless void of night. Gandalf gazes up at the stars one last time, and fades away.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and the others flee the void without him.\" role=\"link\" tabindex=\"0\">You and the others flee the void without him.</a></p>",
		'attributes': ["gandalfDead = 1","FellowshipKilledInMordor+=1"],
		'passages': {
		},
	},
	'you rush into the Gates of Morning': {
		'text': "<p>You exit the void and emerge atop a large hill in Mordor, your backs to the sunrise. In the distance looms Mt. Doom. The Gates of Morning have brought you to your destination.</p>\n<p>&quot;Not in a million years did I imagine we could escape the Doors of Night or the clutches of Morgoth,&quot; Gandalf says. &quot;The fires of Doom are now within sight.&quot;</p>\n<p>{if boromirSacrificed=1:&quot;We&#39;ve come here at a great cost,&quot; Aragorn says. &quot;Boromir has given his life so we might survive. We must get to Mt. Doom immediately and finish our mission.&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You journey there together.\" role=\"link\" tabindex=\"0\">You journey there together.</a></p>",
		'passages': {
		},
	},
	'You and the others flee the void without him.': {
		'text': "<p>You exit the void and emerge atop a large hill in Mordor, your backs to the sunrise. In the distance looms Mt. Doom. The Gates of Morning have brought you to your destination at a great cost.</p>\n<p>Gandalf has fallen into the void.{if boromirDead=1: Boromir was slain by his own demon.} Sam has been taken.{if merryPippinInMordor=1: Merry and Pippin are no longer with you.}{if fellowship=2: Arwen and Glorfindel are no longer with you.} Morale isn&#39;t at its greatest.</p>\n<p>Aragorn tells everyone they mustn&#39;t grieve when the mountain is so near.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You journey there together.\" role=\"link\" tabindex=\"0\">You journey there together.</a></p>",
		'passages': {
		},
	},
	'You journey there together.': {
		'text': "<p>Aragorn remembers what you said about the Fellowship when you began. {if aragornRemembers=0:{if defeatedMorgoth=0:Now he fears you may be right.}} {if aragornRemembers=1:{if defeatedMorgoth=0:He questions if you&#39;re still right.}} {if aragornRemembers=1:{if defeatedMorgoth=1:He&#39;s glad he took strength in your words and vows you&#39;ll find Sam once the Ring is destroyed.}} {if aragornRemembers=0:{if defeatedMorgoth=1:He&#39;s happy you were wrong.}}</p>\n<p>Hours of journeying later, you approach the mountain. But you are not unheard.</p>\n<p>Legolas warns everyone of a warg raid fast approaching.  Dozens of orc-mounted carnivores charge in your direction. {if gandalfDead=0:Gandalf senses this is once again Saruman&#39;s work.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue96\" role=\"link\" tabindex=\"0\">Everyone readies to fight.</a></p>",
		'passages': {
		},
	},
	'_continue96': {
		'text': "<p>&quot;We haven&#39;t come this far to die!&quot; Gimli shouts.</p>\n<p>As the beasts swarm you, Aragorn{if boromirDead=0: and Boromir} strike at the passing riders. Gimli hacks at their legs. Legolas does crazy elf stuff.{if gandalfDead=0: Gandalf turns his staff into a flamethrower to ward them off.}</p>\n<p>{if samTakenAway=0:In the distance, a war oliphaunt approaches. You see very few soldiers on its back, and it seems to be veering away from you towards the wargs. You see what appears to be the Witch King on its back, but can&#39;t be sure.}</p>\n<p>{if samTakenAway=0:Legolas readies his bow with fifty arrows and prepares to shoot it. &quot;What do you think? Shall I <a class=\"squiffy-link link-section\" data-section=\"kill the beast\" role=\"link\" tabindex=\"0\">kill the beast</a> or <a class=\"squiffy-link link-section\" data-section=\"trust it passes\" role=\"link\" tabindex=\"0\">trust it passes</a>?&quot;}</p>\n<p>{if samTakenAway=1:<a class=\"squiffy-link link-section\" data-section=\"The wargs overwhelm you further.\" role=\"link\" tabindex=\"0\">The wargs overwhelm you further.</a>}</p>",
		'passages': {
		},
	},
	'kill the beast': {
		'text': "<p>You tell him to shoot it. The elf fires his arrows.</p>\n<p>{if fellowship=2:All of his arrows are immediately deflected by an equal amount of arrows shooting from the oliphaunt&#39;s back. Legolas now sees that Arwen and Glorfy are riding the beast, and have prevented him from killing it.}</p>\n<p>{if fellowship=2:Now seeing your friends aboard the oliphaunt, you <a class=\"squiffy-link link-section\" data-section=\"trust it passes\" role=\"link\" tabindex=\"0\">trust it passes</a>.}</p>\n<p>{if fellowship=3:He pierces the oliphaunt through the eyes and face. It blindy runs off-course towards a cliff. The oliphaunt stumbles and falls, taking everyone else with it.}</p>\n<p>{if fellowship=3:Suddenly, <a class=\"squiffy-link link-section\" data-section=\"a knife is thrown in Legolas' back.\" role=\"link\" tabindex=\"0\">a knife is thrown in Legolas&#39; back.</a>}</p>",
		'passages': {
		},
	},
	'The wargs overwhelm you further.': {
		'text': "<p>This is beyond madness. There&#39;s no way you can destroy the Ring now, let alone mount a rescue to save Sam. </p>\n<p>Everyone does their darndest to fight back, but your efforts are fruitless. You see one of Legolas&#39; arrows zing past your head as he attacks a warg behind you.</p>\n<p>Yet just as he saves you, <a class=\"squiffy-link link-section\" data-section=\"a knife is thrown in Legolas' back.\" role=\"link\" tabindex=\"0\">a knife is thrown in Legolas&#39; back.</a></p>",
		'passages': {
		},
	},
	'a knife is thrown in Legolas\' back.': {
		'text': "<p>He drops to his knees and falls over dead.</p>\n<p>Gimli runs to his aid and is crushed in the jaws of a raging warg. Aragorn kills it and its rider quickly. Then he proceeds to kill everything else out of blind fury. {if boromirDead=0:Boromir aids him. }{if gandalfDead=0:Gandalf checks for stragglers.}</p>\n<p>The other wargs are so startled, they run away for now.</p>\n<p>You mourn the loss of your companions. Aragorn insists you <a class=\"squiffy-link link-section\" data-section=\"climb Mt. Doom right away\" role=\"link\" tabindex=\"0\">climb Mt. Doom right away</a>.</p>",
		'attributes': ["gimliDead=1","legolasDead=1","samDead=1","merryDead=1","pippinDead=1","FellowshipKilledInMordor+=1","FellowshipKilledInMordor+=1","FellowshipKilledInMordor+=1","FellowshipKilledInMordor+=1","FellowshipKilledInMordor+=1"],
		'passages': {
		},
	},
	'trust it passes': {
		'text': "<p>The oliphaunt plows through the circling warg-riders, crushing them beneath its feet. </p>\n<p>A ladder drops down and you see the Witch King waving you up.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue97\" role=\"link\" tabindex=\"0\">Aragorn insists you all climb aboard.</a></p>",
		'passages': {
		},
	},
	'_continue97': {
		'text': "<p>You climb the ladder onto the oliphaunt&#39;s back and are surprised to discover {if fellowship=2:Arwen and Glory are up here}{if merryPippinOutsideGate=1:Merry and Pippin are up here}{if PippinOutsideGate=1:Pippin is up here}, along with a short hobbit-sized Witch King.</p>\n<p>The Witch King removes his helmet to reveal he is Sam!</p>\n<p>As you hug Sam, he tells you the tale of how the Witch King brought him to the dungeons at Barad-dûr, but {if fellowship=2:Arwen and Glory}{if merryPippinOutsideGate=1:Merry and Pippin}{if PippinOutsideGate=1:Pippin} miraculously made it through the mountains and rescued him. On their way out, he snatched the Witch King&#39;s helmet and assumed his identity to help steal an oliphaunt.</p>\n<p>{if fellowship=3:{if merryPippinOutsideGate=0:{if PippinOutsideGate=0:}}}</p>\n<p>In the distance, you hear an angry Witch King flying after him.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue98\" role=\"link\" tabindex=\"0\">Sam drives the oliphaunt up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue98': {
		'text': "<p>The elves fire volleys of arrows at the pursuing Witch King on his winged fellbeast. Because the Witch King wears his own ring of invisibility, he appears headless without his helmet.</p>\n<p>The oliphaunt rises to the top of Mt. Doom and Sam puts it in park, next to a cave leading into the main shaft. Everyone climbs off the beast and fights the oncoming hordes rising up the mountain.{if gandalfDead=0: Gandalf wrecks them by the dozens, using powerful magic missile attacks.}</p>\n<p>&quot;We&#39;ll hold off Sauron&#39;s forces,&quot; Legolas tells Aragorn. &quot;Go destroy the Ring!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the cave together.\" role=\"link\" tabindex=\"0\">You enter the cave together.</a></p>",
		'passages': {
		},
	},
	'climb Mt. Doom right away': {
		'text': "<p>It&#39;s a rough climb without Legolas and Gimli. Aragorn batters away warg-riders, but is quickly losing strength.{if boromirDead=0: Boromir is doing no better.}{if gandalfDead=0: Gandalf&#39;s magic is waning fast.}</p>\n<p>You reach a cave near the the top, leading towards the shaft. Enemies continue to chase you.</p>\n<p>{if boromirDead=0:&quot;Go in! I&#39;ll keep Sauron&#39;s forces at bay!&quot; Boromir tells you.}</p>\n<p>{if gandalfDead=0:&quot;I&#39;ll do what I can out here, but you must hurry inside,&quot; Gandalf tells you and Aragorn.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You enter the cave together.\" role=\"link\" tabindex=\"0\">You enter the cave together.</a></p>",
		'passages': {
		},
	},
	'You enter the cave together.': {
		'text': "<p>Here, you find a large cliff overlooking a river of lava.</p>\n<p>&quot;<a class=\"squiffy-link link-section\" data-section=\"Throw the Ring into the flames\" role=\"link\" tabindex=\"0\">Throw the Ring into the flames</a>{if FellowshipKilledInMordor&gt;0: before we lose anyone else},&quot; Aragorn says. {if FellowshipKilledInMordor=7:But it&#39;s just you and him now.}</p>\n<p>The Ring starts whispering to you again. You wish to remember it fondly before destroying it. Even <a class=\"squiffy-link link-section\" data-section=\"spend a few quality moments with the Ring\" role=\"link\" tabindex=\"0\">spend a few quality moments with the Ring</a>.</p>",
		'passages': {
		},
	},
	'Throw the Ring into the flames': {
		'text': "<p>{if precious&gt;8:But you can&#39;t bring yourself to throw it in. You&#39;ve been tempted too many times, and the Ring has you. You <a class=\"squiffy-link link-section\" data-section=\"claim it as yours\" role=\"link\" tabindex=\"0\">claim it as yours</a>, regardless.}</p>\n<p>{if precious&lt;9:Wishing not to prolong this any further, you throw it in.}</p>\n<p>{if precious&lt;9:The Ring melts in the flames and is destroyed. The volcano begins to erupt.}</p>\n<p>{if precious&lt;9:&quot;Good job, Frodo!&quot; Aragorn claims. &quot;Let&#39;s get out of here!&quot;}</p>\n<p>{if precious&lt;9:<a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and you escape.</a>}</p>",
		'passages': {
		},
	},
	'spend a few quality moments with the Ring': {
		'text': "<p>You enjoy the Ring&#39;s company. It flirts with you, begging to be worn. You wish to <a class=\"squiffy-link link-passage\" data-passage=\"flirt back\" role=\"link\" tabindex=\"0\">flirt back</a>.</p>\n<p>&quot;I&#39;m not kidding, Frodo,&quot; Aragorn yells. &quot;<a class=\"squiffy-link link-section\" data-section=\"Throw the Ring into the flames\" role=\"link\" tabindex=\"0\">Throw the Ring into the flames</a> right now. If you even think to <a class=\"squiffy-link link-section\" data-section=\"claim it as yours\" role=\"link\" tabindex=\"0\">claim it as yours</a>, I will stop you at all costs.&quot;</p>",
		'attributes': ["precious+=1"],
		'passages': {
			'flirt back': {
				'text': "<p>You wink at the Ring. It glitters back.</p>",
				'attributes': ["precious+=1"],
			},
		},
	},
	'claim it as yours': {
		'text': "<p>You tell Aragorn the Ring is yours and put it on, turning invisible. He tries to stop you, but you easily slip past and head towards the cave.</p>\n<p>{if boromirDead=0:<a class=\"squiffy-link link-section\" data-section=\"Boromir stands at the exit.\" role=\"link\" tabindex=\"0\">Boromir stands at the exit.</a>}</p>\n<p>{if boromirDead=1:{if gandalfDead=0:<a class=\"squiffy-link link-section\" data-section=\"Gandalf stands at the exit.\" role=\"link\" tabindex=\"0\">Gandalf stands at the exit.</a>}}</p>\n<p>{if boromirDead=1:{if gandalfDead=1:{if samDead=0:<a class=\"squiffy-link link-section\" data-section=\"Sam stands at the exit.\" role=\"link\" tabindex=\"0\">Sam stands at the exit.</a>}}}</p>\n<p>{if boromirDead=1:{if gandalfDead=1:{if samDead=1:<a class=\"squiffy-link link-section\" data-section=\"Aragorn lunges after you.\" role=\"link\" tabindex=\"0\">Aragorn lunges after you.</a>}}}</p>",
		'passages': {
		},
	},
	'Boromir stands at the exit.': {
		'text': "<p>He sees your footprints approaching and grabs you, forcing you to the ground.</p>\n<p>&quot;The Ring has taken you,&quot; he says to your invisible face. &quot;This is not you, Frodo. Remove it immediately.&quot;</p>\n<p>You struggle against Boromir. The Ring suggests you should either <a class=\"squiffy-link link-section\" data-section=\"stab him with your blade\" role=\"link\" tabindex=\"0\">stab him with your blade</a> or <a class=\"squiffy-link link-section\" data-section=\"gouge his eyes out\" role=\"link\" tabindex=\"0\">gouge his eyes out</a>.</p>",
		'passages': {
		},
	},
	'stab him with your blade': {
		'text': "<p>You stab into his side with your blade, but don&#39;t get very deep. This gives him an opportunity to find your hands and wrestle the Ring off.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You lose the Ring to Boromir.\" role=\"link\" tabindex=\"0\">You lose the Ring to Boromir.</a></p>",
		'passages': {
		},
	},
	'gouge his eyes out': {
		'text': "<p>You jam your thumbs in his eye sockets, but he finds your hands quickly and forces you to reliniquish the Ring. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You lose the Ring to Boromir.\" role=\"link\" tabindex=\"0\">You lose the Ring to Boromir.</a></p>",
		'passages': {
		},
	},
	'You lose the Ring to Boromir.': {
		'text': "<p>As he steps past you, Aragorn approaches him. Boromir is suddenly eyeing the Ring himself.</p>\n<p>&quot;Don&#39;t let the Ring take you too,&quot; Aragorn says.</p>\n<p>{if boromirTriedToTakeRing=0:&quot;I said from the beginning this Ring should have gone to Gondor,&quot; Boromir sneers at him. &quot;Now it is clear the Ring should have never gone to Frodo. It will go to me, and I will take it home.&quot;}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirRedeemed=0:&quot;I&#39;m sorry,&quot; Boromir says. &quot;I know I tried to take the Ring before, and I&#39;ve tried to be stronger since. But it&#39;s now clear that the Ring doesn&#39;t belong in Fellowship hands. It will return with me to Gondor.&quot;}}</p>\n<p>{if boromirTriedToTakeRing=0:<a class=\"squiffy-link link-section\" data-section=\"Aragorn draws his sword against Boromir.\" role=\"link\" tabindex=\"0\">Aragorn draws his sword against Boromir.</a>}\n{if boromirTriedToTakeRing=1:{if boromirRedeemed=0:<a class=\"squiffy-link link-section\" data-section=\"Aragorn draws his sword against Boromir.\" role=\"link\" tabindex=\"0\">Aragorn draws his sword against Boromir.</a>}}</p>\n<p>{if boromirRedeemed=1:&quot;I am beyond desiring this Ring now,&quot; Boromir says. &quot;Let me cast it in, Aragorn. Let us rid Middle-Earth of this curse.&quot;}</p>\n<p>{if boromirRedeemed=1:<a class=\"squiffy-link link-section\" data-section=\"Aragorn steps aside for Boromir.\" role=\"link\" tabindex=\"0\">Aragorn steps aside for Boromir.</a>}</p>",
		'passages': {
		},
	},
	'Aragorn draws his sword against Boromir.': {
		'text': "<p>Boromir draws his. &quot;We both knew it would come to this. You will not have the Ring, nor the Throne of Gondor.&quot;</p>\n<p>He attacks Aragorn. Aragorn battles him on the cliffs of Doom. You are powerless from the ground, still winded from Boromir&#39;s surprise attack.</p>\n<p>{if FellowshipKilledInMordor=6:&quot;We&#39;re all that&#39;s left of the Fellowship!&quot; Boromir shouts. &quot;Our bonds are broken; why bother saving anything at all?&quot;}</p>\n<p>{if FellowshipKilledInMordor&lt;2:You wish someone outside the cave could come in to help, but the volcano rumbles too loud for anyone to hear your pleas.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue99\" role=\"link\" tabindex=\"0\">Boromir slips the Ring on.</a></p>",
		'passages': {
		},
	},
	'_continue99': {
		'text': "<p>He&#39;s only invisible for a moment, but it&#39;s enough to stab Aragorn through the gut. Aragorn leans forward in crippling pain.</p>\n<p>And then he manages to grabs Boromir&#39;s wrist and force him towards the cliff. Boromir loses his footing and plummets into the fires belows. Aragorn hears Boromir&#39;s final screams.</p>\n<p>Boromir and the Ring are destroyed.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue100\" role=\"link\" tabindex=\"0\">You get to Aragorn&#39;s side and help pull the sword from his body.</a></p>",
		'attributes': ["boromirDead=1","boromirThrownIn=1","FellowshipKilledInMordor+=1"],
		'passages': {
		},
	},
	'_continue100': {
		'text': "<p>You&#39;re surprised at how little blood there is.</p>\n<p>&quot;It&#39;s old scar tissue,&quot; Aragorn tells you as he wraps up his wound. &quot;I&#39;ve been stabbed there many times.&quot;</p>\n<p>{if FellowshipKilledInMordor&lt;7:<a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and you escape.</a>}</p>\n<p>{if FellowshipKilledInMordor=7:<a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and only the two of you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and only the two of you escape.</a>}</p>",
		'passages': {
		},
	},
	'The volcano erupts and you escape.': {
		'text': "<p>It&#39;s difficult to say how you escape Mordor after that, especially when there&#39;s no eagles coming to save you. But you escape the lava regardless. Most of Mordor is destroyed by its eruption, ending the war.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue101\" role=\"link\" tabindex=\"0\">You find your way back to Lothlorien.</a></p>",
		'passages': {
		},
	},
	'_continue101': {
		'text': "<p>The elves are quick to patch up your wounds, and eager to hear about your encounter with Morgoth.</p>\n<p>{if FellowshipKilledInMordor=0:You&#39;re actually really thrilled that you all survived both Morgoth and Mordor and made it home again.}</p>\n<p>{if FellowshipKilledInMordor&gt;0:{if FellowshipKilledInMordor&lt;4:You journey was not without loss, but you made it through, regardless.}}</p>\n<p>{if FellowshipKilledInMordor&gt;3:You still grieve for your lost friends. It drives you mad how downhill everything went after the warg-riders showed up. And you never figured out what became of Sam. You wonder what you could have done differently.}</p>\n<p>{if gandalfDead=0:While Gandalf stays with the elves, }Aragorn escorts you {if samDead=0: and the others} back to the Shire. {if FellowshipKilledInMordor&lt;6:Everyone else goes their separate ways.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue102\" role=\"link\" tabindex=\"0\">And that&#39;s how your story ends.</a></p>",
		'passages': {
		},
	},
	'_continue102': {
		'text': "<p>During your time in Mordor, Saruman massacred Rohan, but lost his power after your encounter with Morgoth. The land of Gondor carried on defending its borders until the last orc had nowhere else to go.</p>\n<p>The Fellowship agreed to informally disavow one another after Rohan&#39;s fall and Gondor&#39;s expansion into the eastern lands to follow. Without Morgoth pulling strings, the politics of Middle-Earth would change indefinitely in Gondor&#39;s favour, and you didn&#39;t want any part of it. {if boromirThrownIn=1:Especially after Aragorn threw King Denethor&#39;s son into a volcano.}{if boromirDead=0:Boromir did what he could to stop his father, but Gondor stayed a rising threat nonetheless.}</p>\n<p>Regardless, you are satisfied to be home. You help yourself to that {if jam=0:cup of tea}{if jam=1:toast with jam} you&#39;ve been putting off, and enjoy your retirement.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'Aragorn steps aside for Boromir.': {
		'text': "<p>He approaches the cliff and just lobs it in, showing you how it&#39;s done.</p>\n<p>He turns and thanks you. &quot;I saw the power of the Ring in your dream, Frodo. You showed me the monster power makes of us. You gave me the chance to redeem myself... and perhaps my family. You made excellent choices along your journey and were truly a worthy Ring-bearer.&quot; </p>\n<p>&quot;We should go,&quot; Aragorn says, pointing at the erupting volcano.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and you escape.</a></p>",
		'passages': {
		},
	},
	'Gandalf stands at the exit.': {
		'text': "<p>He slams his staff into your invisible face with a calculated swing. Then he drags you over to the pit and steps on your hand.</p>\n<p>&quot;Let it go!&quot; he shouts. &quot;Do it! Do it now!&quot;</p>\n<p>Aragorn kicks your butt a few times for good measure.</p>\n<p>Eventually, you give up the Ring because this is too humiliating.</p>\n<p>The Ring falls into the lava and is destroyed.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and you escape.</a></p>",
		'passages': {
		},
	},
	'Sam stands at the exit.': {
		'text': "<p>He slams his frying pan into your invisible face with a calculated swing. Then he drags you over to the pit and steps on your hand.</p>\n<p>&quot;After all that nonsense, we&#39;re not doing this!&quot; he shouts. &quot;Drop the Ring in now!&quot;</p>\n<p>Aragorn kicks your butt a few times for good measure.</p>\n<p>Eventually, you give up the Ring because this is too humiliating.</p>\n<p>The Ring falls into the lava and is destroyed.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and you escape.</a></p>",
		'passages': {
		},
	},
	'Aragorn lunges after you.': {
		'text': "<p>He manages to grab your invisible legs and trip you up. You scramble and kick to escape, but he drags you to the pit and finds your hand. </p>\n<p>&quot;Let it go!&quot; he shouts, holding your hand over the pit. &quot;Do it! Do it now!&quot;</p>\n<p>You&#39;re very stubborn, but eventually, you give up the Ring because this is too humiliating.</p>\n<p>The Ring falls into the lava and is destroyed.</p>\n<p>{if FellowshipKilledInMordor&lt;7:<a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and you escape.</a>}</p>\n<p>{if FellowshipKilledInMordor=7:<a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and only the two of you escape.\" role=\"link\" tabindex=\"0\">The volcano erupts and only the two of you escape.</a>}</p>",
		'passages': {
		},
	},
	'The volcano erupts and only the two of you escape.': {
		'text': "<p>It&#39;s a difficult trek out of Mordor as it explodes behind you, but you and Aragorn manage. Eventually, Mordor is buried under volcanic ash, and its army has been destroyed, much like your Fellowship.</p>\n<p>&quot;Gandalf, Boromir, Legolas Gimli...&quot; Aragorn sighs. &quot;I&#39;m sorry I could not save your hobbit friends, Frodo. If they&#39;re out there, I&#39;ll find them, I promise you, but I fear the worst. Until then, I shall return you to the Shire.&quot;</p>\n<p>Crossing the Mordor mountains, you tell Aragorn you don&#39;t want to return to the Shire. Not after such a tragic victory. You want to wander Middle-Earth like he does.</p>\n<p>&quot;We are the last men standing, I suppose,&quot; Aragorn says. &quot;The life of a ranger may not suit a hobbit, but if that is your wish, I will grant it. You and I will continue our two-man Fellowship together, in the name of our fallen comrades.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue103\" role=\"link\" tabindex=\"0\">And so you become a ranger.</a></p>",
		'passages': {
		},
	},
	'_continue103': {
		'text': "<p>During your time in Mordor, Saruman massacred Rohan, but lost his power after your encounter with Morgoth. The land of Gondor carried on defending its borders until the last orc had nowhere else to go.</p>\n<p>And you and Aragorn wandered the lands as rangers. He showed you the ropes, and you became as legendary a wanderer as he was. You were inseperable, and while you never found your missing friends, you did find your true calling as the Halfing Ranger of the Wilds, a path that would have made your Uncle Bilbo proud.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'cross the Marshes towards the Black Gate': {
		'text': "<p>Aragorn is so stoked that you&#39;re going this way.{if gandalfDead=0: Gandalf, not so much.}  The Fellowship sets off towards the Dead Marshes.</p>\n<p>It turns out the the Dead Marshes are a massive swamp full of cursed corpses.</p>\n<p>&quot;Walk where I walk,&quot; he instructs everyone. &quot;And space yourselves  If too many travel close together, you might wake the dead.&quot;</p>\n<p>You slowly follow him through the swamp. Swamp gas flickers hypnotically across the water. The others follow behind, single file. {if merryPippinInMordor=1:Merry and Pippin make up the rear.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue104\" role=\"link\" tabindex=\"0\">The Ring starts singing to you.</a></p>",
		'passages': {
		},
	},
	'_continue104': {
		'text': "<p>You are entranced by its company. You wish to <a class=\"squiffy-link link-passage\" data-passage=\"pet the Ring\" role=\"link\" tabindex=\"0\">pet the Ring</a> and <a class=\"squiffy-link link-passage\" data-passage=\"be its friend\" role=\"link\" tabindex=\"0\">be its friend</a>. You don&#39;t care if you <a class=\"squiffy-link link-section\" data-section=\"get distracted\" role=\"link\" tabindex=\"0\">get distracted</a> from your journey.</p>",
		'passages': {
			'pet the Ring': {
				'text': "<p>You fondly touch the Ring. It likes that.</p>",
				'attributes': ["precious+=1"],
			},
			'be its friend': {
				'text': "<p>You lend an ear to the Ring&#39;s problems and be honest about your feelings. It appreciates your sincerity.</p>",
				'attributes': ["precious+=1"],
			},
		},
	},
	'get distracted': {
		'text': "<p>You walk off the path.</p>\n<p>Aragorn catches you before you slip into the water.</p>\n<p>{if merryPippinInMordor=1:But as one disaster is averted, <a class=\"squiffy-link link-section\" data-section=\"another emerges\" role=\"link\" tabindex=\"0\">another emerges</a>.}\n{if merryPippinInMordor=0:The rest of your crossing is quiet and uneventful. This was a good group to bring into Mordor.}\n{if merryPippinInMordor=0:{if gandalfDead=0:As you reach dry land, <a class=\"squiffy-link link-section\" data-section=\"Gandalf gets restless\" role=\"link\" tabindex=\"0\">Gandalf gets restless</a>.}}\n{if merryPippinInMordor=0:{if gandalfDead=1:You reach dry land, air out your boots, and then continue east. There, you see a large, iron gateway barring your way through the mountains. <a class=\"squiffy-link link-section\" data-section=\"You pass by the Black Gate.\" role=\"link\" tabindex=\"0\">You pass by the Black Gate.</a>}}</p>",
		'passages': {
		},
	},
	'another emerges': {
		'text': "<p>Rotten arms have reached up through the marshes and ensnared Merry and Pippin. They scream for help.</p>\n<p>{if gandalfDead=0:Fortunately, <a class=\"squiffy-link link-section\" data-section=\"Gandalf is close enough to help.\" role=\"link\" tabindex=\"0\">Gandalf is close enough to help.</a>}\n{if gandalfDead=1:<a class=\"squiffy-link link-section\" data-section=\"Legolas dashes across the waters to reach them.\" role=\"link\" tabindex=\"0\">Legolas dashes across the waters to reach them.</a>}</p>",
		'passages': {
		},
	},
	'Gandalf is close enough to help.': {
		'text': "<p>He fires a blast of light in their direction. The corpses release both hobbits, but the magic ignites the swamp gas around all of you.</p>\n<p>As he reaches the hobbits, a wall of fire lights up between them and the rest of you. The corpses get rowdy, and you&#39;re forced to fight them away.</p>\n<p>&quot;We&#39;ll head north,&quot; Gandalf calls over the flames. &quot;I have business up there anyway. I&#39;ll take Merry and Pippin with me. Continue to Mordor without us and we&#39;ll regroup later.&quot;</p>\n<p>They retrace their steps to go around the swamp. Aragorn leads you out.</p>\n<p>Your Fellowship has been split up. You are three people fewer.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass by the Black Gate.\" role=\"link\" tabindex=\"0\">You pass by the Black Gate.</a></p>",
		'attributes': ["FellowshipLeft+=1","FellowshipLeft+=1","FellowshipLeft+=1"],
		'passages': {
		},
	},
	'Legolas dashes across the waters to reach them.': {
		'text': "<p>He grabs onto their hands and pulls tightly, but isn&#39;t strong enough to free them of the grabbing hands. No one else is fast enough to come help him.</p>\n<p>You and Sam watch in horror as they&#39;re dragged under the mud.</p>\n<p>Before Aragorn can dive in to save them, several other corpses rise up and start grabbing at your party. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue105\" role=\"link\" tabindex=\"0\">You flee across the swamp, desperate to reach safe ground.</a></p>",
		'attributes': ["merryDead=1","pippinDead=1"],
		'passages': {
		},
	},
	'_continue105': {
		'text': "<p>You are all distraught at the loss of Merry and Pippin. No one knows how else they could have saved them. Aragorn apologizes profusely, but after Gandalf&#39;s fall in Moria, no one can blame him for the dangers they face. It was a miracle Merry and Pippin made it this far to begin with.</p>\n<p>You give your friends a moment of silence and move on, your Fellowship now down by two more.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass by the Black Gate.\" role=\"link\" tabindex=\"0\">You pass by the Black Gate.</a></p>",
		'passages': {
		},
	},
	'Gandalf gets restless': {
		'text': "<p>&quot;I&#39;ve decided to go north anyway,&quot; he declares. &quot;A wizard needs to be places, and it&#39;s not uncommon for me to wander off. You may continue into Mordor.  I&#39;ll meet up with you later somehow.&quot;</p>\n<p>He bids your farewell and heads into the plains up north. You&#39;re not surprised since he did the same thing to your Uncle Bilbo twice{if jam=0:, and even ran off on you at the beginning of this journey}.</p>\n<p>Your Fellowship is now down by one.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass by the Black Gate.\" role=\"link\" tabindex=\"0\">You pass by the Black Gate.</a></p>",
		'attributes': ["FellowshipLeft+=1"],
		'passages': {
		},
	},
	'You pass by the Black Gate.': {
		'text': "<p>&quot;We won&#39;t bother with the Black Gate,&quot; Aragorn says. &quot;If we head south through the Gondor forests, we&#39;re bound to find a trail into Mordor.&quot;</p>\n<p>Boromir insists you find his brother, Faramir, who is leading soldiers in the area right now. Aragorn tells him their reunion will have to wait, because he can&#39;t afford anyone from Gondor learning of your mission. Boromir is very miffed about that.</p>\n<p>{if fellowship=2:The elves move through the trees, keeping a careful watch out for Gondorian scouts. Thanks to Arwen and Glorfy on the team, you can avoid Gondor patrols and slip through the forest unnoticed.}</p>\n<p>{if fellowship=2:Now <a class=\"squiffy-link link-section\" data-section=\"Boromir is getting restless\" role=\"link\" tabindex=\"0\">Boromir is getting restless</a>.}</p>\n<p>{if fellowship=3:<a class=\"squiffy-link link-section\" data-section=\"You are then ambushed by Gondor soldiers.\" role=\"link\" tabindex=\"0\">You are then ambushed by Gondor soldiers.</a>}</p>",
		'passages': {
		},
	},
	'You are then ambushed by Gondor soldiers.': {
		'text': "<p>They demand to know who your Fellowship is. Everyone draws their weapons, but Boromir waves them down.</p>\n<p>&quot;Relax!&quot; he says. &quot;These are my people! They can take us to Faramir! Faramir will help us.&quot;</p>\n<p>The soldiers escort you into the mountains, into a secret cave.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue106\" role=\"link\" tabindex=\"0\">You are taken before their commander, Faramir.</a></p>",
		'passages': {
		},
	},
	'_continue106': {
		'text': "<p>Boromir and Faramir exchange greetings, and Faramir insists the Fellowship be treated fair until he sorts things out with his brother. The two of them go into another chamber together to chat, while you and the others are kept in the waiting room.</p>\n<p>&quot;I don&#39;t like this,&quot; says Sam. &quot;We&#39;re on a secret mission. We shouldn&#39;t be consorting with anyone.{if boromirTriedToTakeRing=1: Especially after Boromir tried to take the You-Know-What.}&quot;</p>\n<p>{if boromirTriedToTakeRing=1:&quot;But surely Frodo forgave him,&quot; Aragorn says. &quot;We must trust that Boromir will do the right thing and keep our mission a secret.&quot;}</p>\n<p>{if boromirTriedToTakeRing=0:You wonder if you can trust Boromir. He seems like he&#39;s been itching to betray you, but hasn&#39;t gotten the chance yet.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue107\" role=\"link\" tabindex=\"0\">Boromir and Faramir step out of their chamber.</a></p>",
		'passages': {
		},
	},
	'_continue107': {
		'text': "<p>{if boromirTriedToTakeRing=0:&quot;Good news, Faramir has agreed to help us,&quot; Boromir tells the Fellowship. &quot;Please, leave your weapons and armour here and follow our armed escort into the dungeon, er -- guest quarters. Definitely not a dungeon. Oh, and leave any valuables, such as forbidden jewelry, in this box right here. For safe-keeping, of course.&quot;}</p>\n<p>{if boromirTriedToTakeRing=0:Aragorn whispers to the Fellowship as non-suspiciously as possible, to not arouse to the guards. &quot;I think he may have betrayed us. On my mark, we shall <a class=\"squiffy-link link-section\" data-section=\"take our leave immediately\" role=\"link\" tabindex=\"0\">take our leave immediately</a>.&quot;}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=0:&quot;Good new, Faramir and his men have agreed to help us,&quot; Faramir tells the Fellowship reluctantly. &quot;I had my misgivings about letting him in on our deeds, but... I think we can trust him.&quot;}}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=0:&quot;Yes,&quot; Faramir says, waving in more guards and eyeing you for forbidden jewelry. &quot;Please, leave your weapons and armour here and make yourselves at home.&quot;}}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=0:Aragorn leans over and whispers. &quot;You... DID forgive him, right? If not, should I recommend we <a class=\"squiffy-link link-section\" data-section=\"take our leave immediately\" role=\"link\" tabindex=\"0\">take our leave immediately</a>.&quot;}}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=1:&quot;Bad news, everyone,&quot; Boromir tells the Fellowship. &quot;I&#39;m afraid I&#39;ll be taking my leave of you now. I feel I am of more value to your journey defending Gondor&#39;s borders with my brother.&quot;}}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=1:Faramir agrees. &quot;Yes, Boromir has told me all about your Fellowship&#39;s Cross-Country Fun Run. I fear I cannot donate to your cause, but I will arrange an escort back to the woods for you. Please <a class=\"squiffy-link link-section\" data-section=\"go enjoy your trip\" role=\"link\" tabindex=\"0\">go enjoy your trip</a> and stop in again soon.&quot;}}</p>",
		'passages': {
		},
	},
	'take our leave immediately': {
		'text': "<p>&quot;Thank you,&quot; Aragorn says to the soldiers, &quot;but I&#39;d rather we show ourselves out before nightfall. Gotta get our steps in, you know? Come, friends, we shall -- RUN!&quot;</p>\n<p>You and the Fellowship push past the guards and escape back through the caves. Boromir orders his soldiers to stop you, but the corridors are too narrow to organize a proper ambush, and your Fellowship easily pushes over and tramples anyone in your path. </p>\n<p>At some point, you happen across their food stores and spy a wagon full of bananas.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue108\" role=\"link\" tabindex=\"0\">Sam pushes the banana cart over.</a></p>",
		'passages': {
		},
	},
	'_continue108': {
		'text': "<p>Bananas scatter across the floor as the guards run in. They comically slip on the fruit and tumble over themselves while making funny sound effects. You stay to watch the hilarity, but Sam pulls you along.</p>\n<p>The Fellowship escapes Faramir&#39;s men and resumes their journey, minus Boromir. His betrayal is now complete.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue through the forests.\" role=\"link\" tabindex=\"0\">You continue through the forests.</a></p>",
		'attributes': ["faramirBetrayal = 1","FellowshipLeft+=1"],
		'passages': {
		},
	},
	'go enjoy your trip': {
		'text': "<p>You bid farewell to Boromir and are escorted back to the woods. It seems by forgiving Boromir, he has elected to keep your mission a secret, but will not be joining you. However, you feel you haven&#39;t seen the last of him or Faramir.</p>\n<p>{if FellowshipLeft&gt;1:The Fellowship is now down by one more, and Aragorn&#39;s starting to take it personal.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue through the forests.\" role=\"link\" tabindex=\"0\">You continue through the forests.</a></p>",
		'attributes': ["FellowshipLeft+=1"],
		'passages': {
		},
	},
	'Boromir is getting restless': {
		'text': "<p>He confesses to the team. </p>\n<p>{if boromirTriedToTakeRing=0:&quot;Listen, I&#39;m going to level with you. I originally planned to take the Ring from Frodo earlier and bring it to Gondor. But it&#39;s become glaringly obvious that I&#39;m neither a good thief, nor a valuable asset to the Fellowship. So I think I&#39;ll just go join my brother anyway and help protect Gondor. Good luck, everyone.&quot;}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=0:&quot;Listen, after what transpired at Amon Hen, I still feel uncomfortable traveling with Frodo. He clearly hasn&#39;t forgiven me, and it&#39;s pretty obvious the Fellowship doesn&#39;t need me. I&#39;m just gonna go find my brother if that&#39;s all fine. Good luck.&quot;}}</p>\n<p>{if boromirTriedToTakeRing=1:{if boromirForgiven=1:&quot;Listen, after what transpired at Amon Hen, I still feel uncomfortable traveling with Frodo. I know he&#39;s forgiven me, but I still don&#39;t feel I&#39;m of value to the Fellowship when I&#39;m near the Ring. I think I&#39;ll go help my brother defend Gondor, and try to help you from the Gondor front instead. Good luck with your travels.&quot;}}</p>\n<p>Boromir leaves the Fellowship. </p>\n<p>{if FellowshipLeft&gt;1:The Fellowship has lost another member, and Aragorn&#39;s starting to take it personal.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue through the forests.\" role=\"link\" tabindex=\"0\">You continue through the forests.</a></p>",
		'attributes': ["FellowshipLeft+=1"],
		'passages': {
		},
	},
	'You continue through the forests.': {
		'text': "<p>As you journey through the woods around the Mountains of Shadow, you sense Aragorn is saddened, and maybe even lost.</p>\n<p>&quot;The truth is, I don&#39;t know where we&#39;re going,&quot; Aragorn confesses. &quot;Elrond never had a plan for us, or a secret route into Mordor. He expected us to make it up as we go along. I fear by not following Gandalf, I may have doomed our Fellowship.&quot;</p>\n<p>Sam chimes in, &quot;Aragorn, I have complete faith that a seasoned ranger like yourself will get us into Mordor, no problem.&quot;</p>\n<p>&quot;Hear, hear!&quot; Gimli declares. {if fellowship=2:The elves all agree. Everyone is counting on Aragorn.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue109\" role=\"link\" tabindex=\"0\">Your great quest into Mordor continues.</a></p>",
		'passages': {
		},
	},
	'_continue109': {
		'text': "<p>First, Aragorn decides you should climb the highest mountain to get your bearings. But after several days&#39; climbing, all you see is more mountains and wastelands. Then you roll down the mountainside and are back where you started.</p>\n<p>Then he decides to follow a narrow stream through the crooks and crannies of the mountains, eventually discovering a secret staircase that leads into the borders. But the Fellowship sees a sign near a cave reading &quot;DANGER: GIANT SPIDER&quot;, and decides to turn back because spiders are scary.</p>\n<p>Finally, Aragorn stays up countless nights, triangulating his position among the stars and consulting his maps, searching for the optimal route into Mordor. Weeks later, he finally locates it just past the citadel of Minas Morgul, and you pass the mountains into Mordor without being discovered.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue110\" role=\"link\" tabindex=\"0\">You arrive at the shore of a massive lake.</a></p>",
		'passages': {
		},
	},
	'_continue110': {
		'text': "<p>Aragorn looks lost again. &quot;I&#39;m sure we&#39;re past Minas Morgul by now, but I&#39;m not familiar with this lake.&quot;</p>\n<p>Gimli checks the map. &quot;There&#39;s not supposed to be a body of water like this for miles around. Where the bloody ale are we?&quot;</p>\n<p>&quot;It&#39;s the Sea of Nurnen,&quot; Legolas points at the map. &quot;We&#39;re nowhere near Minas Morgul. Somehow, we&#39;ve walked completely around Mordor and entered through its southern border. It&#39;ll take forever to walk around this water.&quot;</p>\n<p>Aragorn looks embarassed and exhausted. You wonder if you should <a class=\"squiffy-link link-passage\" data-passage=\"comfort him\" role=\"link\" tabindex=\"0\">comfort him</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Aragorn starts crying.\" role=\"link\" tabindex=\"0\">Aragorn starts crying.</a></p>",
		'passages': {
			'comfort him': {
				'text': "<p>You give him a hug and tell him he did his best.</p>",
			},
		},
	},
	'Aragorn starts crying.': {
		'text': "<p>&quot;I&#39;m a ranger!&quot; he cries. &quot;Wandering is what I do best! How could I have gotten us so lost? But not just lost, no! I missed the entrance to Mordor by an ENTIRE COUNTRY!&quot;</p>\n<p>He stomps his feet and throws his sword in the sand. And then he throws his shield. And then he reaches over to your neck, grabs the Ring, and throws it too. He&#39;s just so mad.</p>\n<p>Legolas and Gimli give him a hug. {if fellowship=2:Arwen and Glorfy sit by quietly to see how this plays out.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue111\" role=\"link\" tabindex=\"0\">A seagull flies down and snatches the One Ring with its beak.</a></p>",
		'passages': {
		},
	},
	'_continue111': {
		'text': "<p>Everyone panics and chases the seagull, but it flies out to sea with the Ring. It is now gone.</p>\n<p>Aragorn curls up and cries some more. Your quest is now at its end at this distant shore. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue112\" role=\"link\" tabindex=\"0\">Sam takes charge.</a></p>",
		'passages': {
		},
	},
	'_continue112': {
		'text': "<p>&quot;All right, folks, we got a seagull to catch,&quot; he says. &quot;Legolas, Gimli, <a class=\"squiffy-link link-passage\" data-passage=\"collect wood\" role=\"link\" tabindex=\"0\">collect wood</a>. Aragorn, Frodo, <a class=\"squiffy-link link-passage\" data-passage=\"gather some rope\" role=\"link\" tabindex=\"0\">gather some rope</a>.{if fellowship=2: Arwen, Glorfy, we need food, water, and supplies.} Get your carpenter pants on, &#39;cause we&#39;re building a boat!&quot;</p>\n<p>Montage time! <a class=\"squiffy-link link-passage\" data-passage=\"Inspirational 80's music\" role=\"link\" tabindex=\"0\">Inspirational 80&#39;s music</a> plays and the entire Fellowship works together to <a class=\"squiffy-link link-section\" data-section=\"build a boat\" role=\"link\" tabindex=\"0\">build a boat</a>!</p>",
		'passages': {
			'Inspirational 80\'s music': {
				'text': "<p>(The song is &quot;The Reflex&quot; by Duran Duran, for those of you playing at home.)</p>",
			},
			'collect wood': {
				'text': "<p>&quot;No, I said gather rope!&quot; Sam shouts at you as you interfere with Gimli&#39;s wood collecting. </p>",
			},
			'gather some rope': {
				'text': "<p>You find a nearby orc supply stash, complete with spare rope, cloth, and other boat-building materials. Aragorn is super-stoked that you&#39;re all working together.</p>",
			},
		},
	},
	'build a boat': {
		'text': "<p>Your finished boat is so beautiful. It&#39;s actually a shoddy raft, but because you crafted it with love, it might as well be a yacht.</p>\n<p>&quot;What shall we name it?&quot; Aragorn asks. &quot;<a class=\"squiffy-link link-section\" data-section=\"enterBoatName, boatName=The Doom Rider\" role=\"link\" tabindex=\"0\">Something mighty?</a> Or <a class=\"squiffy-link link-section\" data-section=\"enterBoatName, boatName=The Rose of the Shire\" role=\"link\" tabindex=\"0\">something sincere?</a> Or <a class=\"squiffy-link link-section\" data-section=\"enterBoatName, boatName=Boaty McBoatFace\" role=\"link\" tabindex=\"0\">something stupid?</a>&quot;</p>",
		'passages': {
		},
	},
	'enterBoatName': {
		'text': "<p>The Fellowship votes and &quot;{boatName}&quot; wins{if boatName=The Rose of the Shire:, based on a suggestion by Sam}. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You set sail!\" role=\"link\" tabindex=\"0\">You set sail!</a></p>",
		'passages': {
		},
	},
	'You set sail!': {
		'text': "<p>{boatName} crashes through the waves with the Fellowship aboard! </p>\n<p>&quot;After that seagull!&quot; Aragorn shouts from the mast.</p>\n<p>&quot;Aye, aye, cap&#39;n,&quot; Gimli shouts from the rudder as he steers through the waves.</p>\n<p>{if fellowship=2:The elves sit}{if fellowship=3:Legolas sits} in the crow&#39;s nest, watching the skies, {if fellowship=2:their bows}{if fellowship=3:his bow} at the ready. That seagull isn&#39;t getting past you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue113\" role=\"link\" tabindex=\"0\">You venture into the sea.</a></p>",
		'passages': {
		},
	},
	'_continue113': {
		'text': "<p>Chasing after a seagull in a poorly-made boat wasn&#39;t the best idea, but it was definitely the team&#39;s most enthusiastic one. After losing Gandalf{if merryPippinInMordor=1:, Merry, Pippin,} and Boromir, this team needed a morale boost.</p>\n<p>And it&#39;s also a great bonding experience too. You sail the sea together, enjoying each other&#39;s company and building better relationships.</p>\n<p>Sam teaches Aragorn how to cook a fish. Aragorn teaches you how to tie a knot. You teach Gimli how to whistle. Gimli teaches Legolas how to burp. Legolas teaches Sam how to snap an orc&#39;s neck. {if fellowship=2:Arwen and Glorfy teach each other about the art of creative liberties.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue114\" role=\"link\" tabindex=\"0\">One night, you all sit down and play poker.</a></p>",
		'passages': {
		},
	},
	'_continue114': {
		'text': "<p>You&#39;re sitting on two jacks, a king, a five, and a three. Everyone but Gimli has folded. He seems pretty smug about his hand. You&#39;ve already wagered most of your fish jerky.</p>\n<p>&quot;I keep my cards&quot; he says. &quot;How about you? Will you <a class=\"squiffy-link link-section\" data-section=\"fold\" role=\"link\" tabindex=\"0\">fold</a> or <a class=\"squiffy-link link-section\" data-section=\"draw\" role=\"link\" tabindex=\"0\">draw</a>?&quot;</p>",
		'passages': {
		},
	},
	'fold': {
		'text': "<p>You give up. Gimli helps himself to the pot of fish jerky that Sam&#39;s been making this whole trip. It turns out he just had two queens{if pokerHand&lt;3:, better than your hand}{if pokerHand=3:, much lower than your hand}.</p>\n<p>{if pokerHand=3:He stares at your straight and laughs. &quot;I would&#39;ve bet my own axe on that hand!&quot;}</p>\n<p>At least you still have some fish jerky for later.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Legolas sees something coming.\" role=\"link\" tabindex=\"0\">Legolas sees something coming.</a></p>",
		'attributes': ["hasFishJerky = 1"],
		'passages': {
		},
	},
	'draw': {
		'text': "<p>You decide to draw. But would you rather <a class=\"squiffy-link link-section\" data-section=\"keep the two jacks\" role=\"link\" tabindex=\"0\">keep the two jacks</a>, or <a class=\"squiffy-link link-section\" data-section=\"aim for a high straight\" role=\"link\" tabindex=\"0\">aim for a high straight</a>, or <a class=\"squiffy-link link-section\" data-section=\"aim for a low straight\" role=\"link\" tabindex=\"0\">aim for a low straight</a>?</p>",
		'passages': {
		},
	},
	'bluff': {
		'text': "<p>{if pokerHand&lt;2:You decide to play your pokerface, which Gimli sees through. He plays two queens, better than your hand.}</p>\n<p>{if pokerHand&lt;2:&quot;Better luck next time!&quot; he laughs, helping himself to the pot.}</p>\n<p>{if pokerHand&lt;2:You&#39;re all out of fish jerky now.}\n{if pokerHand&lt;2:{@hasFishJerky=0}}</p>\n<p>{if pokerHand=2:You decide to play your pokerface, which Gimli doesn&#39;t see through because you aren&#39;t staring at your jacks anymore. He decides to fold with two queens and congratulates you for a good game as you collect the pot of fish jerky.}</p>\n<p>{if pokerHand=2:{@hasFishJerky=10}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Legolas sees something coming.\" role=\"link\" tabindex=\"0\">Legolas sees something coming.</a></p>",
		'passages': {
		},
	},
	'keep the two jacks': {
		'text': "<p>You discard and draw three more cards. It&#39;s an ace, a two, and four. No better than your last hand. You can either <a class=\"squiffy-link link-section\" data-section=\"fold\" role=\"link\" tabindex=\"0\">fold</a> or <a class=\"squiffy-link link-section\" data-section=\"bluff\" role=\"link\" tabindex=\"0\">bluff</a>.</p>",
		'attributes': ["pokerHand = 1"],
		'passages': {
		},
	},
	'aim for a high straight': {
		'text': "<p>You discard a jack, the five, and the three and hope for something big. You get an ace, a two and a four. This is worse than before. Now you have nothing. You can either <a class=\"squiffy-link link-section\" data-section=\"fold\" role=\"link\" tabindex=\"0\">fold</a> or <a class=\"squiffy-link link-section\" data-section=\"bluff\" role=\"link\" tabindex=\"0\">bluff</a>.</p>",
		'attributes': ["pokerHand = 2"],
		'passages': {
		},
	},
	'aim for a low straight': {
		'text': "<p>You discard your king and pair of jacks. You draw an ace, a two and a four, landing on a perfect straight. You wonder if it&#39;s still wise to <a class=\"squiffy-link link-section\" data-section=\"fold\" role=\"link\" tabindex=\"0\">fold</a> at this point, or if it&#39;s time to <a class=\"squiffy-link link-section\" data-section=\"take Gimli down\" role=\"link\" tabindex=\"0\">take Gimli down</a>.</p>",
		'attributes': ["pokerHand = 3"],
		'passages': {
		},
	},
	'take Gimli down': {
		'text': "<p>You slap down your straight against Gimli&#39;s pair of queens. The Fellowship laughs and pats your back as you help yourself to the pot.</p>\n<p>&quot;I&#39;ll get you next time, Master Hobbit,&quot; Gimli chuckles. </p>\n<p>You now have a lot of fish jerky.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Legolas sees something coming.\" role=\"link\" tabindex=\"0\">Legolas sees something coming.</a></p>",
		'attributes': ["hasFishJerky = 10"],
		'passages': {
		},
	},
	'Legolas sees something coming.': {
		'text': "<p>You all stand at guard and see something bursting through the waves ahead of you. It&#39;s long, blue and scaley, like a giant snake.</p>\n<p>&quot;It&#39;s a water drake,&quot; Aragorn says, readying his sword. &quot;<a class=\"squiffy-link link-section\" data-section=\"Be prepared for battle\" role=\"link\" tabindex=\"0\">Be prepared for battle</a>.&quot;</p>\n<p>But you hear smaller cries beneath the waves and feel it would be prudent to <a class=\"squiffy-link link-section\" data-section=\"lower your weapons for a moment\" role=\"link\" tabindex=\"0\">lower your weapons for a moment</a>.</p>",
		'passages': {
		},
	},
	'Be prepared for battle': {
		'text': "<p>You and Sam ready your swords. {if fellowship=3:Legolas notches his arrows.}{if fellowship=2:Legolas and the elves notch their arrows.}  Gimli grabs his axe.</p>\n<p>{boatName} lists as the water drake swims up beside her.</p>\n<p>&quot;Attack!&quot; Aragorn shouts.</p>\n<p>You all attack the drake, splashing furiously into the water as it passes. Arrows fly, axes chops, and swords stabs as its long serpentine body moves past. You hear it moan behind the water and vanish between the surface.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue115\" role=\"link\" tabindex=\"0\">Aragorn prepares for a second attack.</a></p>",
		'passages': {
		},
	},
	'_continue115': {
		'text': "<p>&quot;I don&#39;t think it meant us harm,&quot; Sam says.</p>\n<p>&quot;Can never be too ready,&quot; Aragorn tells him. </p>\n<p>You all end up keeping watch through the night, and nobody gets any sleep. You&#39;re certain you didn&#39;t kill the water drake, but it doesn&#39;t return anyway.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Dawn breaks.\" role=\"link\" tabindex=\"0\">Dawn breaks.</a></p>",
		'attributes': ["notRested = 1"],
		'passages': {
		},
	},
	'lower your weapons for a moment': {
		'text': "<p>You tell everyone to lower their weapons. They stand at ease as the water drake crashes through the waves again... and then passes your ship peacefully.</p>\n<p>As it swims in and out of the water, you see a bioluminescent glow glitter across its scales in gorgeous patterns. You are in awe of its beauty.</p>\n<p>Then you see several smaller drakes dart out of the water as well, swimming past your boat like a glowing river. They are the drake&#39;s babies, following their mother.</p>\n<p>{if hasFishJerky=1:You toss what little fish jerky you have into the water. One of the babies eats it and swims away happily.}\n{if hasFishJerky=10:You toss some of your fish jerky into the water. One of the babies eats it and swims away happily.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue116\" role=\"link\" tabindex=\"0\">The Fellowship stand close together.</a></p>",
		'passages': {
		},
	},
	'_continue116': {
		'text': "<p>Aragorn puts his arms around all of you.</p>\n<p>&quot;I cannot imagine a more perfect moment than this,&quot; he says. &quot;You are more than just my Fellowship... you are my family.&quot;</p>\n<p>A shooting star darts across the night sky. Everyone decides to <a class=\"squiffy-link link-section\" data-section=\"make a wish\" role=\"link\" tabindex=\"0\">make a wish</a>.</p>",
		'passages': {
		},
	},
	'make a wish': {
		'text': "<p>You wish this night would never end.</p>\n<p>You all fall asleep and have beautiful, peaceful dreams.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Dawn breaks.\" role=\"link\" tabindex=\"0\">Dawn breaks.</a></p>",
		'passages': {
		},
	},
	'Dawn breaks.': {
		'text': "<p>You are awakened after the boat crashes into the rocks of Mordor&#39;s northern shore.</p>\n<p>You crawl over the sands of the shore and look back at your ship. {boatName} has been completely obliterated.</p>\n<p>&quot;We&#39;re here,&quot; Aragorn announces, looking upon the vast desolate fields of Mordor. &quot;The Ring is still lost, and will very likely never be seen again. Who&#39;s down for going home?&quot;</p>\n<p>You all agree to go home, but decide to take the scenic route.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You head north towards Mt. Doom.\" role=\"link\" tabindex=\"0\">You head north towards Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You head north towards Mt. Doom.': {
		'text': "<p>{if notRested=0:You make excellent time because of last night&#39;s sleep. This stretch of the quest is a breeze.}</p>\n<p>{if notRested=1:This stretch of the quest is a terrible slog since you haven&#39;t slept in a while. The whole Fellowship takes turns yawning.}</p>\n<p>Fortunately, Mordor&#39;s inner borders are less guarded and you&#39;re able to cross their many fields and chasms without attracting any attention.</p>\n<p>After days of travel, you see Mt. Doom in the distance, surrounded by orc camps. The Fellowship stands together on a rocky plateau and enjoys the view of the fiery volcano.</p>\n<p>You admire the view for a while, then prepare to head back east.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue117\" role=\"link\" tabindex=\"0\">Then you suddenly see an orc camp explode.</a></p>",
		'passages': {
		},
	},
	'_continue117': {
		'text': "<p>The orcs swarm around an intruder heading your way.</p>\n<p>&quot;It&#39;s Gandalf!&quot; Legolas exclaims.</p>\n<p>{if gandalfDead=0:Gandalf has returned from journey up north, now suddenly rocking some fabulous white robes, riding a white horse, and kicking butt with his super-charged wizard staff.}\n{if gandalfDead=1:You were certain Gandalf fell in Moria, but here he is, alive and well, rocking some nice white robes, and blasting orcs with his super-charged wizard staff.} </p>\n<p>{if merryPippinInMordor=1:{if merryDead=0:{@merryPippinExtreme=1}}}</p>\n<p>{if merryPippinExtreme=1:Merry and Pippin are fighting alongside him. Only now Merry is sporting stylish battle-armour and a glowing buster sword, while Pippin is driving a futuristic steel mechwarrior and gunning orcs down.}</p>\n<p>&quot;Behold, I have served my wizardly ways and returned to you, more powerful than before!&quot; Gandalf declares, as he explodes another camp.</p>\n<p>{if merryPippinExtreme=1:Merry waves at you with his enchanted buster sword. It glows with electrical magic. &quot;Frodo, Sam! You won&#39;t believe the adventure we had! There was time-travel, parallel universes and everything!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue118\" role=\"link\" tabindex=\"0\">Gandalf notices something wrong as he approaches you.</a></p>",
		'passages': {
		},
	},
	'_continue118': {
		'text': "<p>&quot;Where&#39;s the Ring?&quot; he asks.</p>\n<p>&quot;A seagull took it,&quot; Gimli says.</p>\n<p>Gandalf insists you get it back, but the hordes of Mordor are bearing down on your position. He&#39;s starting to realize there&#39;s no point in going to Mt. Doom now. He also realizes he&#39;s alarmed the whole country to your location.</p>\n<p>&quot;Fight time again!&quot; Aragorn declares as a massive army of orcs head your way, accompanied by goblins, trolls, oliphaunts, and the Witch King atop his winged fellbeast.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue119\" role=\"link\" tabindex=\"0\">The quest for the Ring is over. Your battle for survival begins.</a></p>",
		'passages': {
		},
	},
	'_continue119': {
		'text': "<p>{if merryPippinExtreme=1:Merry activates his sword&#39;s chain lightning attack and dives into the fray, frying orcs left and right. Pippin charges in, guns blazing, low on ammo.}</p>\n<p>{if fellowship=2:Arwen and Glorfy do a quadruple backflip into the fray, firing arrows in all directions and mowing down the first wave. They pull out their twin blades and spin around like tornadoes against the horde.}</p>\n<p>Gandalf charges up his staff and unleashes a powerful energy blast across the fields, shouting &quot;SPECIAL BEAM CANNON!&quot;</p>\n<p>You, Aragorn and the others take up the rear and fight back with all your might.{if notRested=0: Fortunately, you are very well rested and bonded, so you hold your ground very well.}{if notRested=1: Unfortunately, you are very tired, so you get more nicks and bruises than you plan for.}</p>\n<p>{if notRested=0:<a class=\"squiffy-link link-section\" data-section=\"You hear a shriek in the sky.\" role=\"link\" tabindex=\"0\">You hear a shriek in the sky.</a>}\n{if notRested=1:<a class=\"squiffy-link link-section\" data-section=\"You grow weary of this battle.\" role=\"link\" tabindex=\"0\">You grow weary of this battle.</a>}</p>",
		'passages': {
		},
	},
	'You hear a shriek in the sky.': {
		'text': "<p>&quot;The water drakes are coming!&quot; Sam shouts.</p>\n<p>You see a giant, blue dragon flying your way. Its body is long and serpentine, and its wingspan blocks out the sky. Alongside it are dozens of flying babies. This must be the same dragon you saw last night!</p>\n<p>The dragon fires a blast of high-pressure water from its mouth at the orcs, hosing them down across the plains as it swoops by. The babies follow suit, soaking your enemies.</p>\n<p>{if hasFishJerky&gt;0:One baby gets knocked out of the sky and lands at your feet. It&#39;s still rather large, and looks ride-able. It stands and meets you, as if expecting something.}</p>\n<p>{if hasFishJerky=1:<a class=\"squiffy-link link-section\" data-section=\"You're all out of fish jerky.\" role=\"link\" tabindex=\"0\">You&#39;re all out of fish jerky.</a>}\n{if hasFishJerky=10:<a class=\"squiffy-link link-section\" data-section=\"You see if you still have some fish jerky.\" role=\"link\" tabindex=\"0\">You see if you still have some fish jerky.</a>}\n{if hasFishJerky=0:Having had their fun, <a class=\"squiffy-link link-section\" data-section=\"all the drakes fly away.\" role=\"link\" tabindex=\"0\">all the drakes fly away.</a>}</p>",
		'passages': {
		},
	},
	'You\'re all out of fish jerky.': {
		'text': "<p>You apologize to the baby dragon and tell it you lost the food in a poker game last night, and Gimli ate the last of it this morning.</p>\n<p>The baby shrugs and leaves you alone.</p>\n<p>Having had their fun, <a class=\"squiffy-link link-section\" data-section=\"all the drakes fly away.\" role=\"link\" tabindex=\"0\">all the drakes fly away.</a></p>",
		'passages': {
		},
	},
	'You see if you still have some fish jerky.': {
		'text': "<p>You do! Your poker win pays off! You feed the baby more fish jerky and it offers you a ride.</p>\n<p>Soon, you and Sam are up in the air doing sick tricks and hosing down enemy forces from above.</p>\n<p>Sam shouts &quot;YEEEAAAH! MAKE IT RAIN!&quot; as he fist-pumps in the air.</p>\n<p>Your baby does a cool barrel roll near the Witch King and sprays him off his fellbeast. The Witch King lands on an oliphaunt, causing it trip and fall over onto another oliphaunt, leading to a domino effect across Mordor of just oliphaunts falling down.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue120\" role=\"link\" tabindex=\"0\">The baby brings you back to the Fellowship.</a></p>",
		'passages': {
		},
	},
	'_continue120': {
		'text': "<p>You dismount and wave goodbye as it flies back to its mother.</p>\n<p>Then, having had their fun, <a class=\"squiffy-link link-section\" data-section=\"all the drakes fly away.\" role=\"link\" tabindex=\"0\">all the drakes fly away.</a></p>",
		'passages': {
		},
	},
	'all the drakes fly away.': {
		'text': "<p>&quot;That was nice of them,&quot; Aragorn smiles.</p>\n<p>{if boromirForgiven=1:<a class=\"squiffy-link link-section\" data-section=\"Then you hear more horses approaching.\" role=\"link\" tabindex=\"0\">Then you hear more horses approaching.</a>}\n{if boromirForgiven=0:<a class=\"squiffy-link link-section\" data-section=\"You grow weary of this battle.\" role=\"link\" tabindex=\"0\">You grow weary of this battle.</a>}</p>",
		'passages': {
		},
	},
	'Then you hear more horses approaching.': {
		'text': "<p>From the east, you see a calvary of horses approach. They are led by none other than BOROMIR AND FARAMIR!</p>\n<p>&quot;Gondor has arrived!&quot; Boromir shouts as he and his soldiers plow into the orcs. It&#39;s a pretty amazing comeback, and you&#39;re so glad you forgave him.</p>\n<p>But even with Gondor&#39;s help, it seems there&#39;s no end in sight. <a class=\"squiffy-link link-section\" data-section=\"You grow weary of this battle.\" role=\"link\" tabindex=\"0\">You grow weary of this battle.</a></p>",
		'passages': {
		},
	},
	'You grow weary of this battle.': {
		'text': "<p>Legolas points into the sky. You see a glint among a flock of birds.</p>\n<p>&quot;It&#39;s the seagulls!&quot; Aragorn exclaims. &quot;The seagulls are coming! The seagulls are coming!&quot;</p>\n<p>The seagulls fly directly over Mt. Doom. The leader of the flock is carrying the Ring.</p>\n<p>&quot;Take the shot!&quot; Sam shouts.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue121\" role=\"link\" tabindex=\"0\">Legolas aims high and lets loose his bow.</a></p>",
		'passages': {
		},
	},
	'_continue121': {
		'text': "<p>A single arrow soars across Mordor.</p>\n<p>It flies through the flock of seagulls, narrowly missing many, to finally hit its target.</p>\n<p>The one seagull with the Ring falls from the sky, plummetting into Mt. Doom.</p>\n<p>Both the seagull and the Ring are destroyed.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue122\" role=\"link\" tabindex=\"0\">Mt. Doom explodes.</a></p>",
		'passages': {
		},
	},
	'_continue122': {
		'text': "<p>{if boromirForgiven=1:Boromir orders his men to scoop up the Fellowship on their horses and escape the exploding volcano.}</p>\n<p>{if boromirForgiven=0:Gandalf conjurs up a small herd of ghostly wizard horses using his white wizard powers. You all hop on your ghostly steeds and escape the exploding volcano.}</p>\n<p>The forces of Mordor are crushed under Mt. Doom&#39;s destruction.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue123\" role=\"link\" tabindex=\"0\">You escape from Mordor and your journey ends.</a></p>",
		'passages': {
		},
	},
	'_continue123': {
		'text': "<p>You and Sam return to the Shire{if merryPippinExtreme=1: with Merry and Pippin. Thanks to whatever crazy adventure they went on with Gandalf, they&#39;re now the Shire&#39;s local two-hobbit army, and no Black Rider ever messes with the Shire again}. Aragorn joins you, now satisfied that he&#39;s been on his most favourite adventure ever. He lives at Bag End on your couch and cooks many of your meals with the skills Sam taught him. His mastery of potatoes makes him a greater chef than he ever was a ranger.</p>\n<p>Gimli goes on the poker circuit and no one ever sees him again.</p>\n<p>Legolas writes a book about the time he shot down a seagull. It&#39;s Middle-Earth&#39;s biggest best-seller. {if fellowship=2:Arwen and Glorfy drive half of Middle-Earth&#39;s seagull population to extinction trying to copy his success.}</p>\n<p>And Gandalf just wanders off somewhere, destined to send another unsuspecting hobbit on another grand adventure. </p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'Beorn wakes up and addresses the team.': {
		'text': "<p>As you approach Mordor, he grows concerned about how the Fellowship intend to infiltrate it. He knows Elrond didn&#39;t have a secret route in mind, and he&#39;s getting tired of waiting on everyone else, so he puts forward his own proposal: that he take over as team leader and lead the Fellowship directly to Mt. Doom.</p>\n<p>&quot;What qualifies you to be leader?&quot; Boromir asks.</p>\n<p>&quot;I TURN INTO BEEEEEAAAAAAAR!&quot; Beorn shouts.</p>\n<p>&quot;We shall vote,&quot; Aragorn says. &quot;All in favour of Beorn leading our expedition, <a class=\"squiffy-link link-section\" data-section=\"say 'BEAR'\" role=\"link\" tabindex=\"0\">say &#39;BEAR&#39;</a>. All opposed, <a class=\"squiffy-link link-section\" data-section=\"say 'NAARRRGH'\" role=\"link\" tabindex=\"0\">say &#39;NAARRRGH&#39;</a>.&quot;</p>",
		'passages': {
		},
	},
	'say \'BEAR\'': {
		'text': "<p>You plus everyone else votes that Beorn take the lead. {if gandalfDead=0:Gandalf is ECSTATIC.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Beorn leads the charge into Mordor!\" role=\"link\" tabindex=\"0\">Beorn leads the charge into Mordor!</a></p>",
		'passages': {
		},
	},
	'say \'NAARRRGH\'': {
		'text': "<p>{if gandalfDead=1:{@voteNay=7}}\n{if merryPippinFellFromMountain=1:{@voteNay=6}}</p>\n<p>You are vehemently against the crazy bear man taking the lead, so you vote against him.</p>\n<p>The vote is {voteNay} against 1. Everyone but you is super-stoked to have the crazy bear man in charge. {if gandalfDead=0:Gandalf is ECSTATIC.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Beorn leads the charge into Mordor!\" role=\"link\" tabindex=\"0\">Beorn leads the charge into Mordor!</a></p>",
		'passages': {
		},
	},
	'Beorn leads the charge into Mordor!': {
		'text': "<p>First stop, the Dead Marshes!</p>\n<p>Beorn turns into a giant bear and rips into the wetlands, hacking cursed corpses out of the water with his giant paws. The submerged dead rise up to defend themselves, but they&#39;re no match against the bear.</p>\n<p>You and the rest of the Fellowship charge in, swords blazing, and slaughter an entire swamp full of zombies. It&#39;s the most horrid fun you&#39;ve had all trip.</p>\n<p>{if gandalfDead=0:&quot;BEEEAAAARRRRR!&quot; Gandalf screams as he fires magic bolts out of his staff haphazardly in all directions.}</p>\n<p>&quot;Next stop, the Black Gate!&quot; Aragorn declares.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You leave the Marshes and charge the Black Gate.\" role=\"link\" tabindex=\"0\">You leave the Marshes and charge the Black Gate.</a></p>",
		'passages': {
		},
	},
	'You leave the Marshes and charge the Black Gate.': {
		'text': "<p>The Fellowship races towards the mountains. You fast approach an enormous metal gate built into the pass. The orcs on the gate are surprised to see several people and a bear fast approaching. </p>\n<p>The bear rams into the gate! Then the Fellowship rams it! You <a class=\"squiffy-link link-passage\" data-passage=\"ram the gate\" role=\"link\" tabindex=\"0\">ram the gate</a>! You all take turns ramming the gate!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The orcs grow worried.\" role=\"link\" tabindex=\"0\">The orcs grow worried.</a></p>",
		'passages': {
			'ram the gate': {
				'text': "<p>You run into it again! Beorn likes your initiative.</p>",
			},
		},
	},
	'The orcs grow worried.': {
		'text': "<p>Of course, you can&#39;t actually knock down the Black Gate through brute force alone, even with Beorn on your side.</p>\n<p>Beorn orders everyone to follow him towards Minas Morgul instead. You all <a class=\"squiffy-link link-section\" data-section=\"head south together\" role=\"link\" tabindex=\"0\">head south together</a>, leaving the Black Gate alone.</p>\n<p>The orcs on the gate resume their daily business, unsure what to make of the crazy bear incident.</p>",
		'passages': {
		},
	},
	'head south together': {
		'text': "<p>You race along the border towards Mordor&#39;s next entry point. As you pass through a forest clearing, you are ambushed by Gondorian soldiers. You prepare to fight them.</p>\n<p>Boromir raises his arms and waves you down. &quot;Stop! These are my brother&#39;s men! Faramir can help us into Mordor, I know it!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue124\" role=\"link\" tabindex=\"0\">Just then, an oliphaunt storms through the clearing!</a></p>",
		'passages': {
		},
	},
	'_continue124': {
		'text': "<p>A group of Haradrim ride the enormous war oliphaunt, raining arrows and spears on the parties below!</p>\n<p>Your elves jump into action! Legolas, Arwen, and Glorfy climb up the oliphaunt&#39;s legs and start slaughtering the men riding it. You climb up too, just for fun. Beorn grabs the oliphaunt by one leg and shakes it like a giant tree, until all the enemy soldiers fall off.</p>\n<p>The Gondorians finish off the attackers, and you are now left with a giant oliphaunt in your care.</p>\n<p>&quot;We can <a class=\"squiffy-link link-section\" data-section=\"ride this to Minas Morgul\" role=\"link\" tabindex=\"0\">ride this to Minas Morgul</a>!&quot; Legolas exclaims.</p>\n<p>&quot;Nuts to that, let&#39;s <a class=\"squiffy-link link-section\" data-section=\"go back and storm the Black Gate\" role=\"link\" tabindex=\"0\">go back and storm the Black Gate</a>!&quot; Gimli says.</p>",
		'passages': {
		},
	},
	'go back and storm the Black Gate': {
		'text': "<p>Beorn loves Gimli&#39;s idea. The whole Fellowship bids the Gondor soldiers farewell and climbs aboard the mighty beast. Aragorn takes the reigns and drives it back the way you came from.</p>\n<p>Soon, the orcs at the Black Gate are surprised to see you return - and with an oliphaunt no less!</p>\n<p>You ram the oliphaunt into the Black Gate! And again! And again! While you ram it, the elves fire volleys of arrows over the gates. The trolls manning the gate controls flee in terror, dislodging the gate chains as they run.</p>\n<p>The oliphaunt successfully smashes its way through the Black Gate!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ride your oliphaunt into Mordor!\" role=\"link\" tabindex=\"0\">You ride your oliphaunt into Mordor!</a></p>",
		'passages': {
		},
	},
	'ride this to Minas Morgul': {
		'text': "<p>You decide to travel south and storm Mordor&#39;s famous citadel. You bid the soldiers farewell, climb onto your mighty beast and stomp forward with your whole Fellowship aboard.</p>\n<p>Meanwhile, the dark citadel of Minas Morgul is enjoying an uneventful afternoon. That is, until a giant oliphaunt storms the drawbridge. Your elves fire volleys of arrows into the fortress. </p>\n<p>{if witchKingDanceOff=0:The Witch King is dispatched to deal with you. He flies out on his flying fellbeast, but the oliphaunt grabs him out of the air with its mighty trunk, brutally slams him to the ground, and steps on him.}</p>\n<p>{if witchKingDanceOff=1:Taking a cue from Bombadil, you sing a victory song about how much you will rock them. You clap your hands and the oliphaunt stomps its feet. The orcs flee in terror at your epic singing.{if gandalfDead=0: Gandalf immediately asks you to stop.}}</p>\n<p>The oliphaunt rips through the citadel like tissue paper and continues through to the other side.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ride your oliphaunt into Mordor!\" role=\"link\" tabindex=\"0\">You ride your oliphaunt into Mordor!</a></p>",
		'passages': {
		},
	},
	'You ride your oliphaunt into Mordor!': {
		'text': "<p>You stomp across the desolate Mordor plains towards a great volcano in the distance. All the orc camps in your way evacuate as you smash through them. Your elves continue to shoot down everything with their infinite supply of arrows. {if gandalfDead=0:Gandalf casts a rapid-fire spell on his staff and guns down additional orcs with energy blasts.}</p>\n<p>On your right, you see the Tower of Barad-dûr, with the great Flaming Eye of Sauron adorning it. The eye casts a light upon your oliphaunt, and focuses an intense laser at your position.</p>\n<p>Beorn orders everyone to jump off as the laser blasts the oliphaunt. You fall into the camp below where you safely land on top of some tents. The oliphaunt&#39;s armour takes the brunt of the blast, leaving the great beast mostly uninjured.</p>\n<p>Enraged, your oliphaunt storms off towards the tower and RAMS it at full-speed. The Flaming Eye widens in horror as the entire tower is SMASHED at its base and KNOCKED OVER. Sauron&#39;s Flaming Eye EXPLODES as it contacts the ground.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue125\" role=\"link\" tabindex=\"0\">You all high-five.</a></p>",
		'passages': {
		},
	},
	'_continue125': {
		'text': "<p>As Beorn snaps another orc&#39;s neck, he tells everyone how proud he is of your victory. He regales you with tales of his father conquering the ancient hordes and his fellow comrades who fought by his side. He believes you all are worthy of song in the same right.</p>\n<p>&quot;YOU ALL TURN INTO BEEEEAAAARRRRR!&quot; he declares with a tear in his eye.</p>\n<p>And then, somehow by magic, you are all bears now. You have been granted the Blessing of the Skin-Changers. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are now a FELLOWSHIP OF BEARS.\" role=\"link\" tabindex=\"0\">You are now a FELLOWSHIP OF BEARS.</a></p>",
		'passages': {
		},
	},
	'You are now a FELLOWSHIP OF BEARS.': {
		'text': "<p>You&#39;ve never felt so liberated. You are a tiny sun bear, with black fur and a yellow crescent on your chest. The Ring still hangs from a chain around your neck.</p>\n<p>Aragorn has turned into a polar bear. Boromir is a grizzly. Gimli is a sloth bear. The elves all become plain brown bears, much to their disappointment. {if gandalfDead=0:Gandalf is a panda wearing a wizard hat.}</p>\n<p>&quot;ROAR!&quot; shouts Aragorn, which means, &quot;Let&#39;s go <a class=\"squiffy-link link-section\" data-section=\"climb up Mt. Doom as bears\" role=\"link\" tabindex=\"0\">climb up Mt. Doom as bears</a>!&quot;</p>\n<p>&quot;ROAR, ROAR!&quot; Gimli replies, which means &quot;But first let&#39;s go <a class=\"squiffy-link link-section\" data-section=\"steal some hunny\" role=\"link\" tabindex=\"0\">steal some hunny</a>!&quot;</p>",
		'passages': {
		},
	},
	'steal some hunny': {
		'text': "<p>None of the bears can argue with a good hunny heist.</p>\n<p>You sneak around the orc camp and discover their food stores. Sure enough, they have a big vat of hunny just waiting for you. You all jam your heads in the vat and lap up the sweet nectar.</p>\n<p>Aragorn spots his ranger friend, Ranger Smith, walking by with a pic-a-nic basket. He sneaks up behind his friend, taps him on the right shoulder, and then steals the pic-a-nic basket from the left side while Smith is distracted.</p>\n<p>You all enjoy a delicious pic-a-nic lunch with hunny. </p>\n<p>Now you&#39;re ready to <a class=\"squiffy-link link-section\" data-section=\"climb up Mt. Doom as bears\" role=\"link\" tabindex=\"0\">climb up Mt. Doom as bears</a>.</p>",
		'passages': {
		},
	},
	'climb up Mt. Doom as bears': {
		'text': "<p>Your Fellowship of Bears ascends the volcano, determined to destroy the Ring so you can go back to doing regular bear stuff. Boromir is really excited to go salmon fishing after this.</p>\n<p>You find a cave (one worthy of hibernating in) and enter the heart of the mountain, where you find a ledge overlooking a great pool of lava.</p>\n<p>&quot;ROOOAAARRRR!&quot; Beorn tells you, which means, &quot;<a class=\"squiffy-link link-section\" data-section=\"Destroy the Ring now\" role=\"link\" tabindex=\"0\">Destroy the Ring now</a>. Don&#39;t <a class=\"squiffy-link link-section\" data-section=\"waste another minute of bear time\" role=\"link\" tabindex=\"0\">waste another minute of bear time</a>!&quot;</p>",
		'passages': {
		},
	},
	'waste another minute of bear time': {
		'text': "<p>You play with the Ring for a while, tapping it around with your paws. You roll over on your back and chew on it for a while.</p>\n<p>The other bears come over and help you to your feet. Legolas bites your chain off while Arwen and Glorfy take turns adorably batting it towards the lava.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are then rudely interrupted.\" role=\"link\" tabindex=\"0\">You are then rudely interrupted.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'Destroy the Ring now': {
		'text': "<p>You wrestle with the Ring, trying to slide the chain off your neck. It&#39;s very hard because you are a bear, and the fur is in your way.</p>\n<p>The other bears come over to help. Aragorn pushes the chain off while Boromir carefully pats it towards the cliff.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are then rudely interrupted.\" role=\"link\" tabindex=\"0\">You are then rudely interrupted.</a></p>",
		'passages': {
		},
	},
	'You are then rudely interrupted.': {
		'text': "<p>A flash of light appears before you and the other bears, and a large, armoured human figure stands before you, made of ghostly light.</p>\n<p>It is SAURON, made tangible by his sheer hatred for what the oliphaunt just did to his tower.</p>\n<p>&quot;So... &quot; he growls, &quot;A merry band of Skin-Changers are we? You&#39;re BEAR-ly worth my effort, but if you wish to play...&quot;</p>\n<p>Sauron changes shape as well. Beorn growls at the others, warning them that Sauron was a reknowned Skin-Changer in his time as well.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue126\" role=\"link\" tabindex=\"0\">Sauron turns into...</a></p>",
		'passages': {
		},
	},
	'_continue126': {
		'text': "<p>...A giant werewolf! Yes, really!</p>\n<p>You can&#39;t believe Sauron is a werewolf. Beorn assures you it&#39;s actually real, canonical and not made up just now. In fact, Sauron invented werewolves in Middle-Earth. Beorn invites you to look it up when this is over.</p>\n<p>The werewolf attacks with amazing kung-fu moves! He roundhouse kicks Boromir (Bearamir!) and uses his deadly 1000 punch combo on the elves. They parry using their paw-esome blocking techniques. {if gandalfDead=0:Gandalf magically transforms his wizard staff into bamboo and snacks on it.}</p>\n<p>You and Gimli bite Sauron&#39;s ears, but he throws you off, and backflips away. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue127\" role=\"link\" tabindex=\"0\">Beorn makes a plan.</a></p>",
		'passages': {
		},
	},
	'_continue127': {
		'text': "<p>It&#39;ll take the combined efforts of the Fellowship to overpower Sauron, but one of you must keep him off-guard.</p>\n<p>He tells you someone needs to either <a class=\"squiffy-link link-section\" data-section=\"distract the werewolf\" role=\"link\" tabindex=\"0\">distract the werewolf</a> or <a class=\"squiffy-link link-section\" data-section=\"volunteer to hold him steady\" role=\"link\" tabindex=\"0\">volunteer to hold him steady</a>.</p>",
		'passages': {
		},
	},
	'distract the werewolf': {
		'text': "<p>You just suggest a distraction would be best. Aragorn knows just the thing.</p>\n<p>Now that he&#39;s a polar bear, he always knows where to find a cold, refreshing bottle of Coca-Cola, even in a volcano. He tosses you a bottle. As you chug down the sugary bottle of liquid death, Sauron gets envious and wants a sip.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"That's when the Fellowship attacks!\" role=\"link\" tabindex=\"0\">That&#39;s when the Fellowship attacks!</a></p>",
		'passages': {
		},
	},
	'volunteer to hold him steady': {
		'text': "<p>You volunteer to hold him steady... with the biggest BEAR HUG ever!</p>\n<p>Sauron doesn&#39;t see you coming, as the Malayan Sun Bear is the shortest species of bear, and just under his direct eyeline. You hug his legs tightly. He struggles to kick you free. You keep on huggin&#39;!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"That's when the Fellowship attacks!\" role=\"link\" tabindex=\"0\">That&#39;s when the Fellowship attacks!</a></p>",
		'passages': {
		},
	},
	'That\'s when the Fellowship attacks!': {
		'text': "<p>&quot;WERE... BEAR... STAAAARRRRE!!!!!&quot; Beorn shouts, as the whole Fellowship stands up on their hindlegs and shoots beams of glowing shapes out of their tummies.</p>\n<p>Sauron is struck by amazing, glowing colours and shapes. Hearts! Stars! Clovers! Diamonds! Rainbows! Birthday Cake! Maple leafs!</p>\n<p>He staggers backwards, overwhelmed by your comradery, and falls off the cliff, snagging the Ring on his paw as he falls into the lava.</p>\n<p>Both Werewolf Sauron and the Ring are DESTROYED!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and the other bears escape the mountain!\" role=\"link\" tabindex=\"0\">You and the other bears escape the mountain!</a></p>",
		'passages': {
		},
	},
	'You and the other bears escape the mountain!': {
		'text': "<p>As the volcano erupts, debris rains down around Mordor, crushing all the orcs and destroying Sauron&#39;s army.</p>\n<p>You continue out of Mordor on paw, stopping by every river to see if you can find some salmon. Then you roll around in some mud to stay cool in the sun. Being a bear is amazing!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue128\" role=\"link\" tabindex=\"0\">You run all the way back west, roaring victoriously.</a></p>",
		'passages': {
		},
	},
	'_continue128': {
		'text': "<p>Beorn tells you you can all change back to human form whenever you want, but none of you do.</p>\n<p>Boromir heads home to Minas Tirith and decides to stay a bear. King Denethor is so pleased, he immediately announces Boromir as king. He becomes Middle-Earth&#39;s first Bear-King.</p>\n<p>Gimli and the elves find a nice cave and hibernate.</p>\n<p>Aragorn heads north to see the effects of global warming firsthand and help save his fellow polar bears from the tyranny of mankind.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue129\" role=\"link\" tabindex=\"0\">You head back to the Shire.</a></p>",
		'passages': {
		},
	},
	'_continue129': {
		'text': "<p>{if gandalfDead=0:Beorn and Gandalf join you.}\n{if gandalfDead=1:Beorn joins you. On your way back, you run into Gandalf, who&#39;s been resurrected as a white wizard. Beorn turns him into a panda, and you invite him to come live with you.}</p>\n<p>And that&#39;s how three bears came to live at Bag End. Since you never turn back and never tell your neighbours who you really are, they just blindly accept that three bears moved into Frodo&#39;s house and don&#39;t ask questions (as hobbits are known to do.) The only visitor you ever get is a little girl with golden locks who keeps eating your porridge.</p>\n<p>Congratulations! Middle-Earth is saved! And it&#39;s all thanks to you, the Fellowship of Bears!</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'You are carried away towards Rohan.': {
		'text': "<p>{if fellowship=3:{if merryDead=0:{@merryPippinInRohan=1}}}</p>\n<p>Days pass. You are carried by Orcs vast distances over the land, towards the lands of Rohan. {if merryPippinInRohan=1:You discover Merry and Pippin too were captured by the same orcs.} The orcs were ordered to capture a halfling by the wizard Saruman, but don&#39;t know anything about the Ring you carry. {if fellowship&gt;1:There is no sign of Sam among the horde.}</p>\n<p>Your hands are bound. You are unable to sneak away or even wear the Ring. All you can do is wait to be taken to Saruman.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue130\" role=\"link\" tabindex=\"0\">And then, one night, a group of horsemen attack the Orcs.</a></p>",
		'passages': {
		},
	},
	'_continue130': {
		'text': "<p>The orcs are quickly slaughtered. In the chaos, you see an opportunity to escape into Fangorn Forest. {if merryPippinInRohan=1:You see Merry and Pippin escape their captors and heads towards it.} You could <a class=\"squiffy-link link-section\" data-section=\"escape into the forest\" role=\"link\" tabindex=\"0\">escape into the forest</a>, but maybe you could also <a class=\"squiffy-link link-section\" data-section=\"take your chances with the horsemen\" role=\"link\" tabindex=\"0\">take your chances with the horsemen</a> and see what happens?</p>",
		'passages': {
		},
	},
	'take your chances with the horsemen': {
		'text': "<p>You flag down one of the Riders as they massacre orcs. One of them rides up behind you and strikes you in the back of the head, believing you&#39;re an attacker.</p>\n<p>You collapse in the grass as the horses continue their assault. </p>\n<p>Everything goes dark.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You wake up in a dungeon.\" role=\"link\" tabindex=\"0\">You wake up in a dungeon.</a></p>",
		'passages': {
		},
	},
	'You wake up in a dungeon.': {
		'text': "<p>It&#39;s cold and dingy in here. You hear the sounds of soldiers upstairs. You must have been taken prisoner by the Riders of Rohan. You discover they haven&#39;t take the Ring and it&#39;s safely in your possession.</p>\n<p>You hear a creepy whimpering from your neighbour&#39;s cell. You can&#39;t see who it is through the wall.</p>\n<p>&quot;My Precious,&quot; a sad creature cries, &quot;Now we&#39;ll never sees our Precious...&quot;</p>\n<p>You&#39;re on the fence about <a class=\"squiffy-link link-section\" data-section=\"greeting your creepy neighbour\" role=\"link\" tabindex=\"0\">greeting your creepy neighbour</a> or <a class=\"squiffy-link link-section\" data-section=\"staying perfectly quiet\" role=\"link\" tabindex=\"0\">staying perfectly quiet</a>.</p>",
		'passages': {
		},
	},
	'greeting your creepy neighbour': {
		'text': "<p>You say hello to the miserable creature and ask who it is.</p>\n<p>&quot;We were taken by the nasty horsemen!&quot; it snaps. &quot;We only wanted to find our Precious! Followed a nasty hobbit all the way to horselands we did! Wanted to cut its throat and tear out its eyes and take our Precious back!&quot;</p>\n<p>You wisely keep your identity to yourself.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Your time in prison hardens you.\" role=\"link\" tabindex=\"0\">Your time in prison hardens you.</a></p>",
		'passages': {
		},
	},
	'staying perfectly quiet': {
		'text': "<p>You avoid making friends with creepy prisoners and stay quiet in your cell, plotting your escape. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Your time in prison hardens you.\" role=\"link\" tabindex=\"0\">Your time in prison hardens you.</a></p>",
		'passages': {
		},
	},
	'Your time in prison hardens you.': {
		'text': "<p>The minutes pass and you grow accustomed to prison life. You learn to watch your own back. You can&#39;t trust anyone but yourself. You know the value of a good shiv.</p>\n<p>Ten minutes later, you hear excitement upstairs. There&#39;s fighting and shouting as the soldiers confront unknown intruders. You swear you can hear Gandalf&#39;s voice amid the chaos. {if gandalfDead=0:The shouting continues for hours, as the intruders are having a very difficult time with something.}</p>\n<p>Finally, you see Aragorn come downstairs with a Rohan soldier. </p>\n<p>&quot;That&#39;s him!&quot; Aragorn exclaims as he sees you, &quot;Please, release him.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue131\" role=\"link\" tabindex=\"0\">The soldier unlocks your cell and you are free.</a></p>",
		'attributes': ["frodoHardened = 1"],
		'passages': {
		},
	},
	'_continue131': {
		'text': "<p>You say goodbye to your fellow prisoner and are led upstairs where you are granted an audience with King Theoden. Some of the Fellowship are here in King Theoden&#39;s hall. You have been brought to Edoras, capital of Rohan.</p>\n<p>{if gandalfDead=1:You are surprised to see Gandalf here (and wearing fabulous white robes)! You ask him how he survived his fall in Moria. He tells you he was killed by the Balrog, but sent back to Middle-Earth by the gods to continue his quest, which sounds about as credible as anything else Gandalf does.}</p>\n<p>{if gandalfDead=0:Gandalf stands with the Fellowship, pleased that they were able to track you down.} You see {if fellowship&gt;1:Sam, }Aragorn, Gimli, and Legolas here as well. {if boromirDead=0:And Boromir&#39;s here, of course.}{if boromirDead=1:You don&#39;t see any sign of Boromir.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue132\" role=\"link\" tabindex=\"0\">You ask where the rest of the Fellowship is.</a></p>",
		'passages': {
		},
	},
	'_continue132': {
		'text': "<p>{if boromirDead=1:Aragorn informs you that Boromir was tragically killed by orcs, shortly after the orcs took you. Gandalf regrets he could not be there to save him.}</p>\n<p>{if fellowship&lt;3:&quot;Arwen and Glorfy have been sent to scout Isengard,&quot; Gandalf says. {if fellowship=1:&quot;Beorn is with them.&quot;}}</p>\n<p>{if fellowship=3:&quot;We found Merry and Pippin out in Fangorn Forest,&quot; Gandalf says. &quot;We left them safely in the care of the Ent people for now. Ents are talking trees, in case you&#39;re wondering.&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue133\" role=\"link\" tabindex=\"0\">King Theoden speaks.</a></p>",
		'passages': {
		},
	},
	'_continue133': {
		'text': "<p>He tells the Fellowship that he&#39;s been under Saruman&#39;s control for a long time, and Gandalf just freed him. His counseler, Wyrmtongue, was an Isengard spy and has returned to Saruman. Now Theoden fears Saruman&#39;s forces will attack.</p>\n<p>Instead of helping in the war, he wishes to take his people and army to Helm&#39;s Deep and hole up in the fortress there.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"So you go to Helm's Deep.\" role=\"link\" tabindex=\"0\">So you go to Helm&#39;s Deep.</a></p>",
		'passages': {
		},
	},
	'escape into the forest': {
		'text': "<p>You decide not to push your luck with the horsemen and book it into the woods. You successfully escape your captors and evade notice by your rescuers.</p>\n<p>{if merryPippinInRohan=1:Merry and Pippin are delighted that you were able to join them. }Not knowing where you&#39;re going, you begin hiking through the woods.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue134\" role=\"link\" tabindex=\"0\">You soon meet a talking tree.</a></p>",
		'passages': {
		},
	},
	'_continue134': {
		'text': "<p>Before he can tell you his name, you guess it&#39;s Treebeard, because he&#39;s a tree with a beard.</p>\n<p>&quot;Ah, hello, little orc{if merryPippinInRohan=1:s},&quot; the tree says. &quot;You should know you&#39;re not welcome in this forest.&quot;</p>\n<p>Treebeard scoops you up and you are now a tree&#39;s prisoner. {if gandalfDead=1:He says he&#39;s taking you to see <a class=\"squiffy-link link-section\" data-section=\"the white wizard.\" role=\"link\" tabindex=\"0\">the white wizard.</a>} {if gandalfDead=0:He says he&#39;s taking you to <a class=\"squiffy-link link-section\" data-section=\"the squishing rock\" role=\"link\" tabindex=\"0\">the squishing rock</a>.}</p>",
		'passages': {
		},
	},
	'the white wizard.': {
		'text': "<p>You&#39;re terrified at the prospect of being brought before Saruman, but instead of a wizard&#39;s tower, Treebeard takes you to a small grove.</p>\n<p>There, you meet Gandalf, alive and well. He is clad in white robes and appears less unwashed than usual.</p>\n<p>You want to <a class=\"squiffy-link link-section\" data-section=\"run and hug him.\" role=\"link\" tabindex=\"0\">run and hug him.</a> {if gandalfAngry&gt;5:But you <a class=\"squiffy-link link-passage\" data-passage=\"think he still smells bad.\" role=\"link\" tabindex=\"0\">think he still smells bad.</a>}</p>",
		'attributes': ["metGandalfInFangorn = 1"],
		'passages': {
			'think he still smells bad.': {
				'text': "<p>You&#39;re very open about your thoughts. Gandalf&#39;s arms were ready for a hug, but now he&#39;s reconsidering, and feeling slightly more insecure about his body odour. </p>",
				'attributes': ["gandalfAngry+=1"],
			},
		},
	},
	'run and hug him.': {
		'text': "<p>You hug Gandalf. {if merryPippinInRohan=1:Merry and Pippin join in.}</p>\n<p>Gandalf tells you that he died in Moria, but was sent back to Earth, now ascended as a white wizard. This raises a lot of theological questions you never had until now.</p>\n<p>&quot;Saruman&#39;s forces are attacking the lands of Rohan,&quot; Gandalf explains. &quot;We need to save Rohan, so Rohan will ride to defend Gondor, so that Gondor can defend us from the forces of Mordor. But we must also keep the Ring safe. Frodo, will you <a class=\"squiffy-link link-section\" data-section=\"stay by my side\" role=\"link\" tabindex=\"0\">stay by my side</a> as I defend Rohan, or <a class=\"squiffy-link link-section\" data-section=\"stay with Treebeard?\" role=\"link\" tabindex=\"0\">stay with Treebeard?</a>&quot;</p>",
		'passages': {
		},
	},
	'stay with Treebeard?': {
		'text': "<p>You decide to take your chances with the talking tree. While Gandalf and the others ride to Edoras to meet with King Theoden, the Ent carries you into the heart of the forest to <a class=\"squiffy-link link-section\" data-section=\"meet with its elders.\" role=\"link\" tabindex=\"0\">meet with its elders.</a></p>",
		'passages': {
		},
	},
	'meet with its elders.': {
		'text': "<p>After a couple days of trodding through the woods, you arrive at a grove where Treebeard meets with even more tree people. They spend hours chatting in Entish, which later turns out to be a drawn-out discussion about the weather.</p>\n<p>To speed things along, one Ent sends news that King Theoden&#39;s people are traveling to the fortress of Helm&#39;s Deep, and are being pursued by an army of Saruman&#39;s Orcs from Isengard.</p>\n<p>&quot;What do you think?&quot; Treebeard asks. &quot;Should we <a class=\"squiffy-link link-section\" data-section=\"assist the people of Rohan\" role=\"link\" tabindex=\"0\">assist the people of Rohan</a> or <a class=\"squiffy-link link-section\" data-section=\"stay out of human affairs?\" role=\"link\" tabindex=\"0\">stay out of human affairs?</a>&quot; </p>\n<p>{if metGandalfInFangorn=0:You haven&#39;t yet found the Fellowship, so you&#39;re on the fence about helping King Theoden&#39;s people. You especially don&#39;t want to mess with Saruman.}</p>\n<p>{if metGandalfInFangorn=1:{if merryPippinInRohan=1:Merry and Pippin chime in that Saruman&#39;s tower should be mostly unguarded now, and the Ents should totally <a class=\"squiffy-link link-section\" data-section=\"lay waste to Isengard.\" role=\"link\" tabindex=\"0\">lay waste to Isengard.</a>}}</p>",
		'passages': {
		},
	},
	'stay out of human affairs?': {
		'text': "<p>You recommend staying out of trouble. This is a nice grove, after all. You&#39;d like to stay here with the Ents and let all of Middle-Earth&#39;s troubles blow over.</p>\n<p>So you hang out with the Ents for a good long while. You teach them some Hobbit folk songs, and they teach you how to speak Entish. Your language lesson takes a while because trees communicate through hours of branches creaking and leaves rustling. You fall asleep several times.</p>\n<p>Over the landscape, you hear the sounds of war. First, there&#39;s a loud battle to the south that lasts throughout the night. Then you hear horses riding west towards Saruman&#39;s tower, followed by another loud battle. Quite a lot is happening while you sit here.</p>\n<p>Eventually, the fighting stops.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue135\" role=\"link\" tabindex=\"0\">Someone soon comes to pick you up.</a></p>",
		'attributes': ["learnedEntish = 1"],
		'passages': {
		},
	},
	'_continue135': {
		'text': "<p>{if metGandalfInFangorn=1:Gandalf arrives on his horse, looking worse for wear.}</p>\n<p>{if metGandalfInFangorn=0:{if gandalfDead=0:Hey, it&#39;s Gandalf! Apparently, he&#39;s been looking for you since your capture, and somehow the Fellowship got sucked into King Theoden&#39;s war.}}</p>\n<p>{if metGandalfInFangorn=0:{if gandalfDead=1:Hey, it&#39;s Gandalf! He&#39;s back from the dead and sporting cool white robes. He was sent back to life to come help you, but he somehow got sucked into King Theoden&#39;s war with the Fellowship.}}</p>\n<p>He tells you things went well at the Battle of Helm&#39;s Deep and Rohan succeeded. {if fellowship=3:But when everyone stormed Isengard to defeat Saruman, it was mostly a stand-still. He thinks the Ents could&#39;ve helped, but they were too busy teaching you how to ask &quot;Where is the bathroom?&quot; in Entish.}{if fellowship&lt;3:Then Theoden&#39;s army stormed Isengard, but Arwen and Glorfy already seized the whole tower by themselves{if fellowship=1: with the help of Beorn.} This frees up Theoden&#39;s army to come help with the Mordor problem.}\n{if fellowship&lt;3:{@rohanWillFight}}</p>\n<p>{if fellowship&lt;3:Seeing that the not-orcs have this war under control, Treebeard bids you farewell.}\n{if fellowship=3:Treebeard promises they&#39;ll come help with the next war.}\n{if fellowship=3:{@entsWillFight=1}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue136\" role=\"link\" tabindex=\"0\">Gandalf takes you with him.</a></p>",
		'passages': {
		},
	},
	'_continue136': {
		'text': "<p>You{if merryPippinInRohan=1:, Merry, Pippin} and Gandalf ride to a meeting spot with the Fellowship. {if fellowship&gt;1:You&#39;re delighted to see Sam here. He&#39;s been hiding out in a crypt all night waiting for the fighting to stop.} {if fellowship=1:You&#39;re happy to see Beorn again. You missed that crazy bear man.}</p>\n<p>{if boromirDead=0:No one seems to be missing since the last time you saw them. That bodes well.}\n{if boromirDead=1:You notice Boromir is missing. You ask where he is and learn he was killed by orcs shortly after your arrival.}</p>\n<p>Gandalf tells everyone that Sauron&#39;s army is moving on the city of Minas Tirith. He wants to take you and <a class=\"squiffy-link link-section\" data-section=\"ride to Minas Tirith\" role=\"link\" tabindex=\"0\">ride to Minas Tirith</a> to warn them.</p>",
		'passages': {
		},
	},
	'assist the people of Rohan': {
		'text': "<p>You fear for your friends&#39; safety and encourage the Ents to march on Helm&#39;s Deep. Their hearts aren&#39;t entirely in it, but they like Gandalf, so they gather a small army of dozens and head out. Treebeard carries you on his shoulders.</p>\n<p>{if merryPippinInRohan=1:Merry and Pippin insist on taking Isengard instead, but you&#39;re the boss, so they go along with you.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue137\" role=\"link\" tabindex=\"0\">The Ents soon arrive at Helm&#39;s Deep.</a></p>",
		'passages': {
		},
	},
	'_continue137': {
		'text': "<p>It&#39;s early in the morning hours. A storm rains down upon thousands of Orcs attacking the walls of the fortress. The people of Rohan fight back from atop the wall, and they seem to have the upper hand. {if metGandalfInFangorn=0:You notice Aragorn, {if boromirDead=0:Boromir, }Gimli, and Legolas among them.} The elves of Lothlorien are here too. </p>\n<p>Like a rampaging forest, the Ents attack the Orc army from behind. Treebeard rushes forward and boots five Orcs across the battlefield with a single kick. His companions easily sweep the field alongside him, preventing any possibility of retreat.</p>\n<p>Treebeard then sees one Orc race towards the wall carrying a torch. Someone on the wall is shouting to stop him. Treebeard obliges by stomping the torch-bearer into the mud, unknowingly preventing the wall from being blown to pieces.</p>\n<p>The battle goes very smoothly after that. Nobody&#39;s favourite characters die, and King Theoden is super-happy about the outcome. Gandalf even shows up at the end of the battle with back-up infantry and is disappointed that his efforts were not needed. {if gandalfDead=1:{if metGandalfInFangorn=0:At the very least, you&#39;re happy to see Gandalf&#39;s alive for some reason.}</p>\n<p>Theoden shouts, &quot;Hey, let&#39;s <a class=\"squiffy-link link-section\" data-section=\"go get Saruman now\" role=\"link\" tabindex=\"0\">go get Saruman now</a>!&quot;</p>",
		'passages': {
		},
	},
	'go get Saruman now': {
		'text': "<p>So he, Gandalf, Aragon and the rest all gather up your troops and the Ents and head to Isengard to put an end to that damn wizard.</p>\n<p>{if fellowship&lt;3:But your efforts aren&#39;t needed here either. Theoden&#39;s army pulls up to the tower at Isengard and discovers the remains of Saruman&#39;s army scattered across a bloody battle field. Arwen and Glorfy are camped out on the front steps of the tower, covered with blood and enjoying some beef jerky. Saruman&#39;s head can be seen upon a nearby pike. {if fellowship=1:Beorn, in his giant bear form, can be seem roaming around the outskirts of the tower, searching for stragglers.}}</p>\n<p>{if fellowship&lt;3:Legolas feels sad that he missed another murder spree with his fellow elves. Elf murder sprees are his favourite. {if fellowship=1:Meanwhile, Beorn bites the head off an escaping Uruk-hai.}}</p>\n<p>{if fellowship&lt;3:Theoden shrugs and tells Gandalf, &quot;With Saruman&#39;s army gone, it looks like we can help you with that Mordor problem after all.&quot;}</p>\n<p>{if fellowship&lt;3:Treebeard agrees. &quot;Mordor is downhill from here. I always liked walking downhill. The Ents will help you with that Mordor problem too.&quot;}\n{if fellowship&lt;3:{@rohanWillFight=1}}\n{if fellowship&lt;3:{@entsWillFight=1}}</p>\n<p>{if fellowship=3:Unfortunately, Saruman watched the whole battle of Helm&#39;s Deep through his crystal ball and was now prepared for an Ent ambush. He has his Orcs prepare several flaming catapults in advance, and uses them to burn the Ent army to ashes as they attack Isengard.}</p>\n<p>{if fellowship=3:You fall from Treebeard as he collapses in flames. The Rohirrim ride past and take the tower by force, but not without heavy casualties.}</p>\n<p>{if fellowship=3:In the end, Saruman&#39;s forces are destroyed, as are the Ents. Theoden&#39;s men suffer too many casualties. He confesses to you and Gandalf, &quot;The men of Rohan will no longer be able to ride to your aid.&quot;}</p>\n<p>In a nearby puddle, <a class=\"squiffy-link link-section\" data-section=\"you spot what appears to be a large crystal ball\" role=\"link\" tabindex=\"0\">you spot what appears to be a large crystal ball</a>, fallen from the tower. </p>",
		'passages': {
		},
	},
	'stay by my side': {
		'text': "<p>You choose to go with Gandalf. {if merryPippinInRohan=1:Merry and Pippin choose to stay with Treebeard. You go your separate ways for now.}</p>\n<p>Gandalf summons his {if gandalfDead=1:brand new white horse, Shadowfax}{if gandalfDead=0:old grey horse, Horsey McHorseFace}, and you ride with him into a distant part of the forest where you regroup with the remaining Fellowship. {if fellowship&gt;1: Sam is overjoyed to see you.} {if boromirDead=1:You are saddened to discover Boromir died trying to rescue you.}</p>\n<p>Gandalf tells them the plan. {if fellowship&lt;3:He asks {if fellowship=1:Beorn, }Arwen and Glorfy to scout the road to Isengard and report on Saruman&#39;s activities.} </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue138\" role=\"link\" tabindex=\"0\">You ride to the gated city of Rohan, Edoras.</a></p>",
		'passages': {
		},
	},
	'_continue138': {
		'text': "<p>Here, Gandalf tries to warn King Theoden of Saruman&#39;s attack, but Theoden is already possessed by Saruman&#39;s dark magic. </p>\n<p>{if gandalfDead=1:Gandalf easily white magics the evil out of Theoden, and chases out Saruman&#39;s spy, Wyrmtongue.}\n{if gandalfDead=0:Gandalf tries to magick the evil out of Theodon, but Saruman&#39;s influence is too great. You watch as he calls in a young priest and and old priest, holds Theoden down, and spends the next several hours pumping Saruman&#39;s power out of Theoden&#39;s head. Theoden vomits a lot and it&#39;s easily the worst thing you ever watched. But eventually he goes back to normal. Meanwhile, the king&#39;s counsel, Wyrmtongue, sneaks out and takes a few bagels with him.}</p>\n<p>Everything else in Edoras goes fine, but Theoden wants to take his forces and hole up in Helm&#39;s Deep.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"So you go to Helm's Deep.\" role=\"link\" tabindex=\"0\">So you go to Helm&#39;s Deep.</a></p>",
		'passages': {
		},
	},
	'So you go to Helm\'s Deep.': {
		'text': "<p>At this point, you feel like your journey has become completely back-burnered. Gandalf runs off somewhere and leaves you in Aragorn&#39;s care. Theoden leads his army across the fields of Rohan to a great fortress carved into the cliffs.</p>\n<p>Along the way, you meet Theoden&#39;s lovely daughter, Eowyn. Aragorn seems to take a liking to her, but she oddly has eyes for you. She asks <a class=\"squiffy-link link-section\" data-section=\"what kind of bands you like\" role=\"link\" tabindex=\"0\">what kind of bands you like</a>, but Aragorn wants to make the first move and insists you <a class=\"squiffy-link link-section\" data-section=\"don't ruin this for him\" role=\"link\" tabindex=\"0\">don&#39;t ruin this for him</a>.</p>",
		'passages': {
		},
	},
	'don\'t ruin this for him': {
		'text': "<p>You respect Aragorn as a friend and let him make the first moves on Eowyn. He flexes his muscles at her, but she&#39;s uninterested in another rugged, bearded man.</p>\n<p>She&#39;s also lost interest in you, because you deflected her advances.</p>\n<p>The rest of the journey is spent in sad silence.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue to Helm's Deep.\" role=\"link\" tabindex=\"0\">You continue to Helm&#39;s Deep.</a></p>",
		'passages': {
		},
	},
	'what kind of bands you like': {
		'text': "<p>You think about some bands you like. You&#39;d like to <a class=\"squiffy-link link-section\" data-section=\"chat about your favourite guilty pleasures\" role=\"link\" tabindex=\"0\">chat about your favourite guilty pleasures</a>, but maybe you should <a class=\"squiffy-link link-section\" data-section=\"stick to the mainstream\" role=\"link\" tabindex=\"0\">stick to the mainstream</a>.</p>",
		'passages': {
		},
	},
	'stick to the mainstream': {
		'text': "<p>You name some very popular music groups, and list all their chart-topping songs as your favourites.</p>\n<p>She suddenly grows disappointed and bored with you. She thought you might be more exciting, but she was wrong.</p>\n<p>Aragorn moves in on her next, but gets shot down immediately. He blames you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue to Helm's Deep.\" role=\"link\" tabindex=\"0\">You continue to Helm&#39;s Deep.</a></p>",
		'passages': {
		},
	},
	'chat about your favourite guilty pleasures': {
		'text': "<p>You name some obscure music groups you like, mostly on the indie fringes. Some of your picks are embarassing to admit, but she seems to like your bizarreness. She talks about her obscure music tastes as well, and even discusses something called &#39;manga&#39; that she&#39;s totally into. You lend an ear to her eclectic thoughts.</p>\n<p>Eowyn now thinks you&#39;re pretty cool.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue to Helm's Deep.\" role=\"link\" tabindex=\"0\">You continue to Helm&#39;s Deep.</a></p>",
		'attributes': ["eowynLikesYou = 1"],
		'passages': {
		},
	},
	'You continue to Helm\'s Deep.': {
		'text': "<p>Here, Aragorn asks you to <a class=\"squiffy-link link-section\" data-section=\"stay in the crypts below\" role=\"link\" tabindex=\"0\">stay in the crypts below</a> and be safe. {if fellowship&gt;1:Sam is down for this plan.}</p>\n<p>{if eowynLikesYou=0:But you really want to <a class=\"squiffy-link link-section\" data-section=\"watch the coming battle.\" role=\"link\" tabindex=\"0\">watch the coming battle.</a>}\n{if eowynLikesYou=1:But Eowyn is restless and feels like going topside with you to <a class=\"squiffy-link link-section\" data-section=\"watch the coming battle.\" role=\"link\" tabindex=\"0\">watch the coming battle.</a>}</p>",
		'passages': {
		},
	},
	'stay in the crypts below': {
		'text': "<p>{if eowynLikesYou=1:You don&#39;t want to leave the crypt. Now Eowyn thinks you&#39;re lame.}\n{if eowynLikesYou=1:{@eowynLikesYou=0}}</p>\n<p>You stay in the crypts for the night. Up above, you hear Saruman&#39;s forces arrive and attack Helm&#39;s Deep. It sounds quite exciting and you wish you could see it. You hear horses riding, massive explosions, and a giant horn and wonder what that was all about. </p>\n<p>Hours later, Aragorn comes down to the crypt and waves you upstairs.</p>\n<p>{if entsAngry=0:&quot;We won!&quot; he says.}\n{if entsAngry=1:&quot;We lost!&quot; he exclaims. &quot;We need to get out of here, now!&quot;}</p>\n<p>{if entsAngry=0:{if gandalfDead=0:But sadly, King Theoden was killed in the battle, due to the complications Gandalf had purging him of Saruman&#39;s magic. You won the battle and <a class=\"squiffy-link link-section\" data-section=\"you leave Helm's Deep\" role=\"link\" tabindex=\"0\">you leave Helm&#39;s Deep</a> with a small armament of Rohan&#39;s soldiers.}}</p>\n<p>{if entsAngry=0:{if gandalfDead=1:It turns out Gandalf&#39;s new powers helped turn the tide big-time. With the battle won and Theoden&#39;s army secure, <a class=\"squiffy-link link-section\" data-section=\"you leave Helm's Deep\" role=\"link\" tabindex=\"0\">you leave Helm&#39;s Deep</a> and wonder if you can get back to your adventure now.}}</p>\n<p>{if entsAngry=1:You discover that Treebeard and the Ents showed up near the end of battle and helped the orcs by kicking the crap out of Theoden&#39;s army. Theoden himself was killed in the attack. Apparently, the Ents were still miffed over Gandalf attacking Treebeard earlier. Hastily, you <a class=\"squiffy-link link-section\" data-section=\"flee Helm's Deep with the Fellowship\" role=\"link\" tabindex=\"0\">flee Helm&#39;s Deep with the Fellowship</a>.} \n{if entsAngry=1:{@theodenDead=1}}</p>",
		'passages': {
		},
	},
	'watch the coming battle.': {
		'text': "<p>As soon as Aragorn leaves, you sneak out of the crypt{if eowynLikesYou=1: with Eowyn}. {if fellowship&gt;1:Sam doesn&#39;t notice you leave.} You climb up into one of the unmanned guard towers where you&#39;ll have a great view of the battle.</p>\n<p>And what a fantastic view it is, too. When Saruman&#39;s army arrives, they&#39;re 10,000 orcs strong and black out the fields. Theoden&#39;s army fights them as they raise ladders against the wall, and all seems to be going well. You get quite bored watching it, and <a class=\"squiffy-link link-passage\" data-passage=\"consider blowing the big battle horn\" role=\"link\" tabindex=\"0\">consider blowing the big battle horn</a> just for fun.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue139\" role=\"link\" tabindex=\"0\">And then some guy with a torch shows up.</a></p>",
		'passages': {
			'consider blowing the big battle horn': {
				'text': "<p>&quot;BRRRROOOOOUUUUUUUUUUUUUUUUUU,&quot; goes the horn. Everyone wonders who&#39;s messing around in the horn tower. {if eowynLikesYou=1:Eowyn blows it again just for fun.}</p>",
			},
		},
	},
	'_continue139': {
		'text': "<p>An orc carrying a strange torch lights something ablaze at the foot of the wall and blows a great hole open in the wall, allowing all the orcs into Helm&#39;s Deep.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue140\" role=\"link\" tabindex=\"0\">This suddenly took a turn for the worst.</a></p>",
		'passages': {
		},
	},
	'_continue140': {
		'text': "<p>Fortunately, Aragorn, Legolas, and Gimli easily repel all the attackers. Many of Theoden&#39;s men take five while the three cavaliers below do their thing. </p>\n<p>Legolas tries to liven things up by killing orcs while surfing down the stairs on a shield. Gimli one-ups him by killing orcs while sledding down the stairs on another orc. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue141\" role=\"link\" tabindex=\"0\">Then the orcs knock down the main entrance with a battering ram.</a></p>",
		'passages': {
		},
	},
	'_continue141': {
		'text': "<p>At the same time, Theoden and Aragon ride out on their horses to <a class=\"squiffy-link link-passage\" data-passage=\"attack the enemy\" role=\"link\" tabindex=\"0\">attack the enemy</a>. And then Gandalf conveniently shows up at daybreak, blinding the enemy as he rides out of the sunlight. {if gandalfDead=0:But Gandalf the Grey is off by a minute, so the sunrise isn&#39;t as effective as it should be.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue142\" role=\"link\" tabindex=\"0\">King Theoden is suddenly swarmed by enemies.</a></p>",
		'passages': {
			'attack the enemy': {
				'text': "<p>You do your part by dropping a brick on an orc below. It bounces harmlessly off his helmet. Good try, though.</p>",
			},
		},
	},
	'_continue142': {
		'text': "<p>{if gandalfDead=0:You see Gandalf ride to help him, but his sword and second-rate wizard magic alone isn&#39;t enough to overwhelm Theoden&#39;s attackers.}</p>\n<p>{if gandalfDead=0:{if eowynLikesYou=0:King Theoden is tragically slain in combat. The battle continues regardless.}}\n{if gandalfDead=0:{if eowynLikesYou=0:{@theodenDead=1}}}</p>\n<p>{if gandalfDead=0:{if eowynLikesYou=1:Eowyn suddenly runs down from the ramparts to help her father. She takes up a sword and defends him, slashing down orc after orc.}}</p>\n<p>{if gandalfDead=0:{if eowynLikesYou=1:And yet, Theoden&#39;s wounds are mortal, due to complications from Saruman&#39;s possession. He hands his daughter his sword and tells her that she must rule Rohan in his place. He passes away in her arms.}}\n{if gandalfDead=0:{if eowynLikesYou=1:{@theodenDead=1}}}</p>\n<p>{if gandalfDead=1:Gandalf target-locks the orcs and fires a volley of magic &#39;white wizard&#39; missiles in their direction. He blasts the attackers to pieces and uses his magic to heal Theoden as he rides by. Now Theoden&#39;s ready for more.}</p>\n<p>{if entsAngry=0:<a class=\"squiffy-link link-section\" data-section=\"Saruman's army is soon in retreat.\" role=\"link\" tabindex=\"0\">Saruman&#39;s army is soon in retreat.</a>}</p>\n<p>{if entsAngry=1:<a class=\"squiffy-link link-section\" data-section=\"But then the Ents show up.\" role=\"link\" tabindex=\"0\">But then the Ents show up.</a>}</p>",
		'passages': {
		},
	},
	'Saruman\'s army is soon in retreat.': {
		'text': "<p>{if theodenDead=0:With the battle won and Theoden&#39;s army secure, <a class=\"squiffy-link link-section\" data-section=\"you leave Helm's Deep\" role=\"link\" tabindex=\"0\">you leave Helm&#39;s Deep</a> and wonder if you can get back to your adventure now.}</p>\n<p>{if theodenDead=1:{if eowynLikesYou=0:The battle is won, but Rohan has lost its leader. As <a class=\"squiffy-link link-section\" data-section=\"you leave Helm's Deep\" role=\"link\" tabindex=\"0\">you leave Helm&#39;s Deep</a>, a small group of soldiers agree to escort you as far as Isengard.}}</p>\n<p>{if theodenDead=1:{if eowynLikesYou=1:The battle is won, but Rohan has lost its king. But in Theoden&#39;s place, many saw Eowyn rise up to defend him. They honour her by immediately naming her the new queen of Rohan. As <a class=\"squiffy-link link-section\" data-section=\"you leave Helm's Deep\" role=\"link\" tabindex=\"0\">you leave Helm&#39;s Deep</a>, she tells you that for your help, Rohan&#39;s army will ride in your time of need.}} </p>",
		'passages': {
		},
	},
	'But then the Ents show up.': {
		'text': "<p>Everything goes to hell very quickly. An army of tree people, led by a very bitter Treebeard, storm the walls of Helm Deep. Rohan&#39;s army is crushed under their brutal assault. They are no match for giant tree monsters.</p>\n<p>&quot;Find the wizard!&quot; Treebeard shouts, still miffed about Gandalf attacking him earlier. &quot;Take him and his friends to the squishing rock!&quot;</p>\n<p>{if theodenDead=0:King Theoden is trampled in the attack. Now Rohan is without a ruler. The Riders of Rohan scatter in terror.}</p>\n<p>{if theodenDead=1:{if eowynLikesYou=1:Eowyn&#39;s reign is short-lived as she is trampled before your eyes. Rohan is now without a ruler. The Riders of Rohan scatter in terror.}}</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"flee Helm's Deep with the Fellowship\" role=\"link\" tabindex=\"0\">flee Helm&#39;s Deep with the Fellowship</a>.</p>",
		'passages': {
		},
	},
	'the squishing rock': {
		'text': "<p>You want to know what the squishing rock is. Treebeard explains it&#39;s a rock that he uses to squish orcs. He goes on to explain that orcs have been chopping down his forests to help build Saruman&#39;s machines of war.</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"try to explain you're not an orc.\" role=\"link\" tabindex=\"0\">try to explain you&#39;re not an orc.</a> Treebeard doesn&#39;t know Orcs from Hobbits, so you&#39;d be better off if you <a class=\"squiffy-link link-section\" data-section=\"use the Ring to escape from Treebeard\" role=\"link\" tabindex=\"0\">use the Ring to escape from Treebeard</a> and head back the way you came.</p>\n<p>{if hasSeed=1:You also have <a class=\"squiffy-link link-section\" data-section=\"Galadriel's seed\" role=\"link\" tabindex=\"0\">Galadriel&#39;s seed</a> handy. Maybe that could help.}</p>",
		'passages': {
		},
	},
	'try to explain you\'re not an orc.': {
		'text': "<p>You describe the Shire and its people. You show Treebeard your hairy feet and rounded ears, and then describe the every nasty detail you know about an orc&#39;s anatomy and culture. You sound like a total racist, but the distinctions should be mind-numbingly apparent to anyone with eyes.</p>\n<p>Treebeard isn&#39;t convinced, however. He still thinks anything with thumbs is an orc.</p>\n<p>{if merryPippinInRohan=0:<a class=\"squiffy-link link-section\" data-section=\"He takes you to the squishing rock.\" role=\"link\" tabindex=\"0\">He takes you to the squishing rock.</a>}</p>\n<p>{if merryPippinInRohan=1:Pippin chimes in, and helps persuade Treebeard by singing a Hobbit folk song. Merry adds to the argument by showing Treebead his &#39;disappearing thumb&#39; trick.}</p>\n<p>{if merryPippinInRohan=1:Treebeard is very convinced you are not orcs now. He carries you through the forest to <a class=\"squiffy-link link-section\" data-section=\"meet with its elders.\" role=\"link\" tabindex=\"0\">meet with its elders.</a>}</p>",
		'passages': {
		},
	},
	'use the Ring to escape from Treebeard': {
		'text': "<p>You slip on the Ring and escape the giant tree monster. Treebeard is confused momentarily, but then goes about his day.</p>\n<p>Not wanting to meet another Ent, you retreat out of Fangorn Forest and <a class=\"squiffy-link link-section\" data-section=\"take your chances with the horsemen\" role=\"link\" tabindex=\"0\">take your chances with the horsemen</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'He takes you to the squishing rock.': {
		'text': "<p>After much walking, you soon arrive at a clearing with a large boulder. Treebeard sets you down, tilts the boulder up, and asks you get under it. Beneath, you see several squished orc corpses. You politely decline. Treebeard reaches to assist you.</p>\n<p>A fireball rings out and strikes Treebead. Gandalf the Grey emerges from the bushes and prepares another spell. Aragorn, Legolas, and Gimli surprise-attack Treebeard as well, with Gimli hacking away at his legs with his axe.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue143\" role=\"link\" tabindex=\"0\">Treebeard flees the scene.</a></p>",
		'passages': {
		},
	},
	'_continue143': {
		'text': "<p>Gandalf was not happy he had to fight off an Ent like that. He blames you for your bad friend-making skills and wishes he could&#39;ve gotten to Fangorn Forest sooner. He hopes the Ents won&#39;t seek retribution.</p>\n<p>Gandalf grows concerned. &quot;The orcs who captured Frodo were Uruk-hai, servants of Saruman. If we are to deliver the Ring safely through Rohan, we&#39;ll have to contend with the rest of Saruman&#39;s forces. Only King Theoden&#39;s army can stand against him.&quot;</p>\n<p>&quot;Frodo, please <a class=\"squiffy-link link-section\" data-section=\"stay by my side\" role=\"link\" tabindex=\"0\">stay by my side</a>, as we go to meet Theoden. The Ring must stay secret at all costs.&quot; </p>",
		'attributes': ["gandalfAngry+=1","entsAngry = 1"],
		'passages': {
		},
	},
	'Galadriel\'s seed': {
		'text': "<p>You toss the seed into a nearby thicket. Treebeard watches with amazement as thousands of vines explode out of it and take root into the forest ground. The vines flourish into an acre&#39;s worth of lush plantlife. You create a beautiful garden of trees and flowers before Treebeard&#39;s very eyes.</p>\n<p>&quot;Maybe... you are not an orc after all,&quot; he says. &quot;Orcs are very good at destroying trees, not growing them.&quot;</p>\n<p>He carries you through the woods to <a class=\"squiffy-link link-section\" data-section=\"meet with its elders.\" role=\"link\" tabindex=\"0\">meet with its elders.</a></p>",
		'passages': {
		},
	},
	'you leave Helm\'s Deep': {
		'text': "<p>Your group travels the road to Isengard with Theoden&#39;s men. {if theodenDead=1:{if eowynLikesYou=0:They are distraught by their king&#39;s death and only agree to escort you this far. They will not help you with your quest as long as Rohan is without a ruler.}}{if theodenDead=1:{if eowynLikesYou=1:Eowyn rides with you, determined to carry her father&#39;s legacy forward and defend Middle-Earth in his honour.}}</p>\n<p>However, you are surprised and delighted that when you arrive, all of Isengard has been laid to seige by the Ents of Fangorn Forest. All the orcs have been killed.</p>\n<p>{if fellowship&lt;2:Arwen and Glorfy are here, having resolved issues on Gandalf&#39;s orders by rallying the Ents of Fangorn Forest against Saruman.} {if fellowship=1:Beorn is here too. He ate Wyrmtongue.}\n{if merryPippinInRohan=1:You find Merry and Pippin in a nearby storehouse enjoying some smoked meat and pipe-weed. They take credit for encouraging the Ents of Fangorn Forest to attack Isengard while Saruman&#39;s army was attacking Helm&#39;s Deep.}</p>\n<p>Saruman stands on top of his tower, shouting at everyone to get off what remains of his lawn.</p>\n<p>In a nearby puddle, <a class=\"squiffy-link link-section\" data-section=\"you spot what appears to be a large crystal ball\" role=\"link\" tabindex=\"0\">you spot what appears to be a large crystal ball</a>, fallen from the tower. </p>",
		'passages': {
		},
	},
	'flee Helm\'s Deep with the Fellowship': {
		'text': "<p>This side-trip through Rohan was a complete disaster.</p>\n<p>{if entsAngry=1:Thanks to the Ents&#39; intervention, }Rohan&#39;s been defeated at Helm&#39;s Deep, and Saruman now has total control over the region. You and the Fellowship book it over the hills and valleys, desperate to make it to Gondor and continue your quest. Fortunately, Saruman&#39;s too busy seizing Rohan&#39;s villages to pay attention to you.</p>\n<p>You sneak past Isengard, where you regroup with {if fellowship&lt;3:Arwen and Glorfy}{if merryPippinInRohan=1:Merry and Pippin}, who were unable to resolve any matters from their end. {if fellowship=1:Beorn is here too, and isn&#39;t thrilled about how things turned out.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue out of Rohan.\" role=\"link\" tabindex=\"0\">You continue out of Rohan.</a></p>",
		'attributes': ["eowynLikesYou = 0"],
		'passages': {
		},
	},
	'you spot what appears to be a large crystal ball': {
		'text': "<p>It beckons to you, begging that <a class=\"squiffy-link link-section\" data-section=\"you pick it up and gaze within.\" role=\"link\" tabindex=\"0\">you pick it up and gaze within.</a> Of course, this could be a magical trap, and to <a class=\"squiffy-link link-section\" data-section=\"keep your distance from the crystal ball\" role=\"link\" tabindex=\"0\">keep your distance from the crystal ball</a> might be wiser.</p>",
		'passages': {
		},
	},
	'you pick it up and gaze within.': {
		'text': "<p>You touch the crystal ball anyway. Immediately, your head is filled with visions of a fiery eye and a great burning tree. The eye of Sauron looks within your mind and reads everything instantly. Gandalf swats the ball out of your hand with his staff.</p>\n<p>You confess you kind of, sort of, maybe possibly just let Sauron know your entire mission.</p>\n<p>&quot;Then we have no choice,&quot; Gandalf says. &quot;We must <a class=\"squiffy-link link-section\" data-section=\"ride to Minas Tirith\" role=\"link\" tabindex=\"0\">ride to Minas Tirith</a> and use King Denethor&#39;s army to carve a path directly through the Black Gate. Now that Sauron knows our mission, there&#39;s no telling what he&#39;ll do to stop us.&quot;  </p>",
		'attributes': ["gandalfAngry+=1","sauronKnows = 1"],
		'passages': {
		},
	},
	'keep your distance from the crystal ball': {
		'text': "<p>{if merryPippinInRohan=0:You wisely avoid that wizard nonsense. No one else notices the ball in the water.}</p>\n<p>{if merryPippinInRohan=0:Gandalf speaks with Saruman and learns that Sauron plots to attack Minas Tirith. He asks you to <a class=\"squiffy-link link-section\" data-section=\"ride to Minas Tirith\" role=\"link\" tabindex=\"0\">ride to Minas Tirith</a> with him.}</p>\n<p>{if merryPippinInRohan=1:Unfortunately, Pippin doesn&#39;t share you wisdom. He picks up the ball and looks within. He immediately screams as visions flood into his head. Gandalf knocks the ball out of his hands with his staff}</p>\n<p>{if merryPippinInRohan=1:Gandalf asks Pippin if he accidentally shared Frodo&#39;s mission with Sauron. Fortunately, Pippin was thinking about second breakfast, and all Sauron snatched from his mind was a hash-brown recipe.}</p>\n<p>{if merryPippinInRohan=1:But Pippin does glean Sauron&#39;s next target from Sauron. Gandalf interprets the dream as, &quot;Sauron will soon attack the white city of Minas Tirith. Frodo and I will <a class=\"squiffy-link link-section\" data-section=\"ride to Minas Tirith\" role=\"link\" tabindex=\"0\">ride to Minas Tirith</a> and warn King Denethor.&quot;}</p>",
		'passages': {
		},
	},
	'ride to Minas Tirith': {
		'text': "<p>{if eowynLikesYou=1:Eowyn says her farewell and promises to rally Rohan to Gondor&#39;s aid when the time comes.}\n{if eowynLikesYou=1:{@rohanWillFight=1}}</p>\n<p>Before you leave, Gandalf has an idea. He looks to Aragorn and tells him to ride to the Valley of Harrowdale and enlist the aid of the Oathbreakers. You have no idea what they&#39;re talking about and tune the conversation out.</p>\n<p>While they&#39;re chatting, you notice a rather nice sword hanging from Gandalf&#39;s saddle. It&#39;s not his usual sword, so you assume he looted it from the battlefield. {if hasSwordSting=1:Sting&#39;s been sort of hit-and-miss lately,}{if hasSwordSting=0:The dingy blade you&#39;ve been carrying since Rivendell has grown even duller,} and you wonder if you should <a class=\"squiffy-link link-passage\" data-passage=\"swap out your weapon\" role=\"link\" tabindex=\"0\">swap out your weapon</a>.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Aragorn and Gandalf wrap up their conversation.\" role=\"link\" tabindex=\"0\">Aragorn and Gandalf wrap up their conversation.</a></p>",
		'passages': {
			'swap out your weapon': {
				'text': "<p>You slide the nice, long sword out of its sheath and replace it with your blade. You conceal your cool, new sword under your cloak.</p>",
				'attributes': ["hasSwordSting = 0","hasSwordAragorn = 1"],
			},
		},
	},
	'Aragorn and Gandalf wrap up their conversation.': {
		'text': "<p>Gandalf hands Aragorn the sword from his saddle{if hasSwordAragorn=1: (the one you &#39;borrowed&#39;)}, and tells him &quot;You&#39;ll need this. It was reforged just for you.&quot;</p>\n<p>Aragorn tells Gimli and Legolas to join. The others ask if they can join, and Aragorn agrees, because the more the merrier. They all hop on horses and ride off towards the &#39;Valley of Harrowdale&#39;. {if fellowship&gt;1:Yes, even Sam goes with them. He prefers being part of the B-story over travelling with you.}</p>\n<p>Meanwhile, Gandalf puts you atop his horse and rides to Minas Tirith. It is a long, uneventful ride with an even longer, much more awkward silence as you and Gandalf seem to have run out of things to talk about.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue144\" role=\"link\" tabindex=\"0\">You approach the White City.</a></p>",
		'passages': {
		},
	},
	'_continue144': {
		'text': "<p>You are soon allowed entry into the city and meet with King Denethor. {if boromirDead=1:Denethor seems really miffed about what happened to his son Boromir in your care.}{if boromirDead=0:Denethor seems really miffed that you showed up without Boromir.} He&#39;s also really miffed about his other son, Faramir, being brought in half-dead from the battlefield. With Mordor&#39;s forces coming, the king of Minas Tirith has lost all will to fight.</p>\n<p>&quot;This city is a lost cause,&quot; Gandalf says to you. &quot;We should <a class=\"squiffy-link link-section\" data-section=\"resume our mission and bring the Ring to Mt. Doom\" role=\"link\" tabindex=\"0\">resume our mission and bring the Ring to Mt. Doom</a>, but I leave the choice to you, Frodo. If we stay to help, we must <a class=\"squiffy-link link-section\" data-section=\"remove Denethor from power.\" role=\"link\" tabindex=\"0\">remove Denethor from power.</a>&quot; </p>",
		'passages': {
		},
	},
	'remove Denethor from power.': {
		'text': "<p>{if hasSwordAragorn=0:{@ghostsWillFight=1}}</p>\n<p>You like the idea of tearing down the monarchy, so you repeatedly ask Gandalf if you can do that, over and over and over again. Eventually, Gandalf knocks out King Denethor and assumes control of his army just to shut you up.</p>\n<p>As the Mordor army soon approaches, Gandalf has the war beacons lit and summons for aid. The soldiers of Minas Tirith line the walls and prepare the catapults. You and Gandalf hang out at the tower and watch as an enormous army of Orcs, humans, trolls, wargs, oliphaunts, and seige towers approach the city.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue145\" role=\"link\" tabindex=\"0\">The Battle of Pelenor Fields begins.</a></p>",
		'passages': {
		},
	},
	'_continue145': {
		'text': "<p>The White City begins by catapulting giant boulders into the field. The Orcs respond by catapulting giant boulders back into the city. As this happens, the seige towers land on the city walls. Orcs pour onto the walls while the trolls try to break down the main gate with a battering ram.</p>\n<p>{if witchKingDanceOff=0:Then the Witch King arrives, flying atop a winged beast. It attacks the soldiers on the wall, but Gandalf repels the wraith with a blast of sunlight from his staff. {if gandalfDead=0:The Witch King laughs off his Grey Wizard power, however, and kills a few more Gondor soldiers for good measure.}}\n{if witchKingDanceOff=1:Then a Black Rider appears, flying atop the same winged beast that the Witch King was riding back at Weathertop. However, it takes one look at you, remembers your epic dance moves, and immediately turns to flee. It blindly flies into a volley of arrows and falls to the ground below, landing on the trolls at the main gate.}</p>\n<p>{if rohanWillFight=1:An army of horsemen soon appear and trample the invading Orcs. With {if theodenDead=0:Theoden}{if theodenDead=1:Eowyn} leading the charge, Rohan has answered the call. {if witchKingDead=0:{if theodenDead=0: Unfortunately, he is promptly eaten as the Witch King&#39;s beast swoops down and bites him off his horse.}}{if witchKingDead=0:{if theodenDead=1: Eowyn even manages to slay the Witch King while she&#39;s here, taking advantage of an ancient prophecy&#39;s gender-biased loophole.}}}</p>\n<p>The oliphants cross the field quickly. {if rohanWillFight=0:With no one to counter them, they ram the walls and reach up the walls with their mighty trunks. Enemy soldiers run up the trunks into the city.}{if rohanWillFight=1:Rohan&#39;s forces ride around their legs, hacking at their tendons and causing them to fall. One soldier wraps a length of rope around an oliphant&#39;s leg and causes it to fall.  }</p>\n<p>{if entsWillFight=1:The Ents then appear over the horizon and swarm the oliphaunts. &quot;Looks like you&#39;re barking up the wrong tree!&quot; Treebeard shouts as he kicks over the biggest oliphaunt and causes a domino effect of oliphaunts falling across the field.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue146\" role=\"link\" tabindex=\"0\">The enemy ships suddenly arrive at the harbour with reinforcements.</a></p>",
		'passages': {
		},
	},
	'_continue146': {
		'text': "<p>{if hasSwordAragorn=1:But the enemy ship has been compromised. At the helm are Aragorn, Legolas and Gimli... and no one else. Whatever mission they were on was unsuccessful for reasons unknown. But they still hop off the ship and fight anyway.}\n{if hasSwordAragorn=0:But the enemy ship has been compromised. At the helm are Aragorn, Legolas and Gimli... and an army of ghosts. You sit back and enjoy the show as the ghosts storm the field and kill literally all the bad guys, making any of your efforts worthless.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue147\" role=\"link\" tabindex=\"0\">Hours later, the battle is finished.</a></p>",
		'passages': {
		},
	},
	'_continue147': {
		'text': "<p>{if rohanWillFight=1:{if entsWillFight=1:{if ghostsWillFight=1:The forces of Mordor has been completely obliterated and the people of Gondor have suffered the most minimal casualties possible. The people of Minas Tirith throw a big party to celebrate.}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=1:{if ghostsWillFight=1:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=1:{if ghostsWillFight=1:The forces of Mordor has been mostly obliterated and the people of Gondor have suffered many casualties. You&#39;re lucky the Ents and ghosts showed up or it could&#39;ve been much worse.}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=1:{if ghostsWillFight=1:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=0:{if ghostsWillFight=1:The forces of Mordor retreat from the ghosts, but the people of Gondor have suffered heavy casualties. Everyone thanks Aragorn for bringing the ghosts.}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=0:{if ghostsWillFight=1:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=0:{if ghostsWillFight=0:The forces of Mordor retreat from the field, but the people of Gondor have suffered heavy casualties. Without Rohan&#39;s riders, it would&#39;ve been worse, but you still could&#39;ve used more help.}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=0:{if ghostsWillFight=0:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=1:{if ghostsWillFight=0:The forces of Mordor retreat from the field, but the people of Gondor have suffered partial casualties. The Riders and Ents drove the enemy back, but weren&#39;t enough to overwhelm them.}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=1:{if ghostsWillFight=0:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=0:{if ghostsWillFight=1:The forces of Mordor retreat from the ghosts, but the people of Gondor have suffered partial casualties. You could&#39;ve used more help against those oliphaunts, but what&#39;s done is done. This was still a pretty good, Tolkien-accurate outcome.}}}</p>\n<p>{if rohanWillFight=1:{if entsWillFight=0:{if ghostsWillFight=1:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=1:{if ghostsWillFight=0:The forces of Mordor retreat from the battle, but the people of Gondor have suffered heavy casualties. Those Ents didn&#39;t get enough of the oliphaunts, and the Orcs overwhelmed the city walls easily. This was a terrible outcome.}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=1:{if ghostsWillFight=0:<a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a>}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=0:{if ghostsWillFight=0:The forces of Mordor have taken the city. Denethor and Faramir have been killed and a troll sits on the throne. You and the rest of the Fellowship quietly sneak away from the seized city, whistling inconspicuously. This was nowhere near an optimal outcome.}}}\n{if rohanWillFight=0:{if entsWillFight=0:{if ghostsWillFight=0:{@lostMinasTirith=1}}}}</p>\n<p>{if rohanWillFight=0:{if entsWillFight=0:{if ghostsWillFight=0:<a class=\"squiffy-link link-section\" data-section=\"The Fellowship heads wearily towards the Black Gate.\" role=\"link\" tabindex=\"0\">The Fellowship heads wearily towards the Black Gate.</a>}}}</p>",
		'passages': {
		},
	},
	'The Fellowship heads wearily towards the Black Gate.': {
		'text': "<p>No one&#39;s thrilled about the Minas Tirith fiasco.</p>\n<p>{if hasSwordAragorn=1:Aragorn tells you about how he tried to use his family sword to summon an army of ghosts, but was accidentally given your sword instead of his. He asks you for his sword back, but you declare Finders Keepers. Aragorn feels dejected.}</p>\n<p>The Fellowship arrives at the Black Gate. Because they took Minas Tirith, the gates are wide open and Orcs are pouring through in celebration. It doesn&#39;t take long for the Fellowship to find some Orc disguises and sneak into Mordor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship is now in Mordor.\" role=\"link\" tabindex=\"0\">The Fellowship is now in Mordor.</a></p>",
		'passages': {
		},
	},
	'The Minas Tirith stuff is done.': {
		'text': "<p>{if hasSwordAragorn=1:Aragorn tells you about how he tried to use his family sword to summon an army of ghosts, but was accidentally given your sword instead of his. He asks you for his sword back, but you declare Finders Keepers. Aragorn feels dejected.}\n{if hasSwordAragorn=0:Their oath to Aragorn&#39;s family fulfilled, the ghosts demand Aragorn release them from his control.{if aragornRemembers=1: Aragorn has faith that his Fellowship is strong enough to complete the mission, so he releases the ghosts from their oath.}{if aragornRemembers=0: However, Aragorn has doubts about the Fellowship completing their mission for some reason. He decides he&#39;ll need the ghosts a little longer.}}\n{if hasSwordAragorn=0:{if aragornRemembers=0:{@hasGhostArmy=1}}}\n{if hasSwordAragorn=0:{if aragornRemembers=1:{@hasGhostArmy=0}}}</p>\n<p>{if lostMinasTirith=0:With Denethor and Faramir incapacitated, the city is without a ruler. The Fellowship doesn&#39;t have time to lead it, however, because you have a Ring to go melt in a mountain.{if boromirDead=0: Boromir swears he&#39;ll come back after your mission is done and help his people.}}\n{if lostMinasTirith=0:With the city burned to the ground, you have no reason to stay here.{if boromirDead=0: Boromir is a crying mess over the loss of everything he ever knew, but you trust he&#39;ll get over it.}}</p>\n<p>The Fellowship sneaks out and hurries across the river to the Black Gate. It takes a lot of dead orcs and elf gymnastics, but you eventually get through the Gate by having Gimli dig a hole under it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Fellowship is now in Mordor.\" role=\"link\" tabindex=\"0\">The Fellowship is now in Mordor.</a></p>",
		'passages': {
		},
	},
	'You continue out of Rohan.': {
		'text': "<p>Gandalf tells the Fellowship, &quot;I know Rohan was a waste of time, but there&#39;s still hope we can defeat this threat. Frodo and I must quickly <a class=\"squiffy-link link-section\" data-section=\"ride to Minas Tirith\" role=\"link\" tabindex=\"0\">ride to Minas Tirith</a> and warn them of Saruman and Sauron&#39;s alliance.&quot;</p>",
		'passages': {
		},
	},
	'lay waste to Isengard.': {
		'text': "<p>Picking a fight with a wizard sounds like a lark. You encourage the Ents to do that. </p>\n<p>And so you, Merry, and Pippin ride Treebeard across Fangorn Forest, south towards the tower of Orthanc at Isengard. Saruman is quite surprised to see an army of trees heading his way. He orders his troops to attack you, but the Ents trample them easily.</p>\n<p>It&#39;s a delightful massacre, and you quite enjoy ruining Saruman&#39;s day. </p>\n<p>Treebeard asks, &quot;How shall we end this? Shall we <a class=\"squiffy-link link-section\" data-section=\"break the dam and flood the tower\" role=\"link\" tabindex=\"0\">break the dam and flood the tower</a> or <a class=\"squiffy-link link-section\" data-section=\"summon more forest friends\" role=\"link\" tabindex=\"0\">summon more forest friends</a> to finish this?&quot;</p>",
		'passages': {
		},
	},
	'break the dam and flood the tower': {
		'text': "<p>Treebeard gestures to a large dam built into the mountainside. You&#39;re down for a mass drowning, so you sit back and enjoy the show as the Ents tear down the dam. They brace themselves as the river flows into Isengard and washes away the remains of Saruman&#39;s army.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Ents high-five each other.\" role=\"link\" tabindex=\"0\">The Ents high-five each other.</a></p>",
		'passages': {
		},
	},
	'summon more forest friends': {
		'text': "<p>You&#39;re curious which forest friends he&#39;s referring to. Treebeard lets out a loud howl and Isengard is immediately swarmed as thousands of sparrows, rabbits, squirrels, raccoons, deer, wolves, spiders, skunks, weasels, foxes, bears, boars, chipmunks, beavers, robins, crows, ducks, herons, geese, swans, hawks, owls porcupines and mooses emerge from the woods and demolish Saruman&#39;s army.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Ents high-five each other.\" role=\"link\" tabindex=\"0\">The Ents high-five each other.</a></p>",
		'passages': {
		},
	},
	'The Ents high-five each other.': {
		'text': "<p>Saruman locks himself in his tower. </p>\n<p>Meanwhile, you, Merry and Pippin discover his storage shed and help yourself to pipeweed and salted pork. You bid farewell to the Ents and wait for the Fellowship to show up.</p>\n<p>When Gandalf and the others eventually arrive, you tell them the story of how you defeated Saruman, but omit the parts about the Ents. They&#39;re quite impressed.</p>\n<p>{if gandalfDead=1:They tell you of their victory at Helm&#39;s Deep, and that King Theoden will send aid in your fight against Mordor.}\n{if gandalfDead=1:{@rohanWillFight=1}}</p>\n<p>{if gandalfDead=0:They tell you of their victory at Helm&#39;s Deep, and the tragedy of King Theoden&#39;s death. Because of his death, you won&#39;t be receiving Rohan&#39;s aid in the fight against Mordor.}</p>\n<p>As you rummage through Saruman&#39;s belongings, <a class=\"squiffy-link link-section\" data-section=\"you spot what appears to be a large crystal ball\" role=\"link\" tabindex=\"0\">you spot what appears to be a large crystal ball</a>.</p>",
		'passages': {
		},
	},
	'resume our mission and bring the Ring to Mt. Doom': {
		'text': "<p>You and Gandalf leave Minas Tirith and head out across Pelennor Fields towards Osgiliath, where you plan to regroup with the Fellowship.</p>\n<p>But Sauron&#39;s forces force you to take a detour and hide in some ruins. You watch as an enormous army of orcs, seige towers, and oliphaunts march on Minas Tirith. They attack the White City without mercy, tearing down its walls and breaking through its gates. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue148\" role=\"link\" tabindex=\"0\">Minas Tirith is laid to seige.</a></p>",
		'passages': {
		},
	},
	'_continue148': {
		'text': "<p>King Denethor&#39;s men weren&#39;t prepared, and before you can think of a way to help them, it&#39;s too late.</p>\n<p>{if rohanWillFight=1:But then Theoden&#39;s men arrive on their horses to help defend the city! But... it&#39;s too late.}</p>\n<p>{if entsWillFight=1:But then the Ents arrive and... it&#39;s too late.}</p>\n<p>{if ghostsWillFight=0:But then Aragorn and the Fellowship arrive, but... it&#39;s too late.}</p>\n<p>{if ghostsWillFight=1:But then Aragorn and the Fellowship arrive WITH AN ARMY OF GHOSTS, but... it&#39;s too late.}</p>\n<p>The White City is burned to the ground.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Minas Tirith stuff is done.\" role=\"link\" tabindex=\"0\">The Minas Tirith stuff is done.</a></p>",
		'attributes': ["lostMinasTirith = 1"],
		'passages': {
		},
	},
	'The Fellowship is now in Mordor.': {
		'text': "<p>You, Gandalf, Aragorn, Gimli and Legolas look upon a vast wasteland of Orc camps leading up to the foot of the fiery Mt. Doom. Looming over the field is a great tower with the flaming Eye of Sauron atop. {if lostMinasTirith=1:Boromir pulls himself together at the sight of it. He&#39;ll cry about Minas Tirith later.}</p>\n<p>{if fellowship&gt;1:The Ring feels heavier here. Sam tells you to hold on just a little longer.}</p>\n<p>{if merryPippinInRohan=1:Merry and Pippin draw their swords and prepare to fight their way through. They&#39;ve been getting really battle-hardened lately and feel pretty good about this.}</p>\n<p>{if fellowship&lt;3:Arwen and Glorfy lick their lips at the sight of the Orc camps. For them, this is Christmas come early.{if fellowship=1: Beorn shape-shifts into a bear and gets ready to join their blood-bath.}}</p>\n<p>{if boromirDead=0:Boromir spins to meet a group of Orcs coming up behind them from the Black Gate. He brandishes his sword and speaks, &quot;We&#39;re at journey&#39;s end. Go forward to Doom; I&#39;ll defend the gate. It&#39;s been an honour to fight with you, gentlemen.&quot;}</p>\n<p>Gandalf lights up his staff and queues up Darude&#39;s &quot;Sandstorm&quot; on his magical future music playlist. He turns to everyone and says, &quot;Let&#39;s go. <a class=\"squiffy-link link-section\" data-section=\"It's time to show Mordor how we do things Fellowship-style.\" role=\"link\" tabindex=\"0\">It&#39;s time to show Mordor how we do things Fellowship-style.</a>&quot;</p>",
		'passages': {
		},
	},
	'It\'s time to show Mordor how we do things Fellowship-style.': {
		'text': "<p>The Fellowship races into Mordor, swords, arrows, and magic spells flying. </p>\n<p>{if boromirDead=0:Boromir lunges at his attackers and cuts down Orc after Orc, decapitating dozens before he finally takes an arrow to his knee. The Uruk-hai who shot him closes in to finish the job.}</p>\n<p>{if boromirDead=0:{if merryPippinInRohan=1:But Merry and Pippin hurry in at the last second and stab the Uruk-Hai to pieces with their tiny knives, saving Boromir and scaring away his attackers.}}</p>\n<p>{if boromirDead=0:{if merryPippinInRohan=0:Boromir leaps forward, taking one last arrow to the heart. He hurls his sword at the Uruk-Hai, decapitating his foe and the other five Orcs standing behind him.}}\n{if boromirDead=0:{if merryPippinInRohan=0:{if lostMinasTirith=0:{@boromirDead=1}}}}</p>\n<p>{if boromirDead=0:{if merryPippinInRohan=0:{if lostMinasTirith=1:But his grief over losing Minas Tirith overwhelms him. Boromir manages to stand with the arrow in his heart and continue fighting. He will not fall now. He will last as long as it takes for Gandalf to come back and heal him.}}}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue149\" role=\"link\" tabindex=\"0\">You storm the camps.</a></p>",
		'passages': {
		},
	},
	'_continue149': {
		'text': "<p>The Fellowship slaughters every Orc along the way. Many are caught unaware and go down without a fight.</p>\n<p>{if fellowship&lt;3:Arwen and Glorfy find a stash of Orc moonshine. They chug it down, grab some torches, and turn their flammable breath into flamethrowers, setting the camp ablaze. Legolas dips his arrows into tar and fires them through their flaming breath, spreading the fire across the field and burning a path towards Mt Doom.}</p>\n<p>{if fellowship=1:Beorn catches fire, but keeps on killing because now he&#39;s a giant bear on fire, making him twice as dangerous as before. This is the best thing Gandalf has ever seen.}</p>\n<p>{if fellowship=3:Aragorn, Legolas and Gimli lead the attack. Sam goes nuts on the orcs&#39; skulls with his frying pan. Gandalf launches magical grenades from his staff.}</p>\n<p>More reinforcements arrive. </p>\n<p>{if merryPippinInRohan=1:{if eaglesComing=1:Then out of nowhere, a giant eagle suddenly swoops down on you and grabs Merry and Pippin instead. It&#39;s the same scarred eagle you saw back at the path of Caradhras. You hear it shriek, &quot;The Ring is ours! Take it back to the Eyrie!&quot;}}</p>\n<p>{if merryPippinInRohan=1:{if eaglesComing=1:Gimli hurls his axe at the bird and knocks it out of the air. Aragorn catches Merry and Pippin as they fall. Legolas shoots more eagles out of the sky and shouts, &quot;More eagles are coming!&quot;}}</p>\n<p>{if hasGhostArmy=0:<a class=\"squiffy-link link-section\" data-section=\"The Fellowship hop on each other's shoulders.\" role=\"link\" tabindex=\"0\">The Fellowship hop on each other&#39;s shoulders.</a>}\n{if hasGhostArmy=1:<a class=\"squiffy-link link-section\" data-section=\"That's when Aragorn's ghost army shows up again.\" role=\"link\" tabindex=\"0\">That&#39;s when Aragorn&#39;s ghost army shows up again.</a>}</p>",
		'passages': {
		},
	},
	'The Fellowship hop on each other\'s shoulders.': {
		'text': "<p>With Aragorn and Legolas as the legs, Sam and Gimli as the arms,{if fellowship=1: Beorn as the torso,}{if fellowship&lt;3: Arwen and Glorfy as swords,} Gandalf as the head, and you as the butt, you&#39;ve combined into a human Mega-Zord of Death. You all spin around, hashing and slashing at your attackers. {if eaglesComing=1:The rogue eagles plummet from the air under your awesome power. }The orcs retreat at the sight of you.</p>\n<p>Then an explosive blast knocks you apart.</p>\n<p>The Flaming Eye of Sauron fires a bolt of otherworldy firepower at you from atop its tower. His rays burn craters into the ground at your feet. A Mega-Zord will not save you here.</p>\n<p>Chased by the Eye&#39;s laser, <a class=\"squiffy-link link-section\" data-section=\"you rush towards Mt. Doom\" role=\"link\" tabindex=\"0\">you rush towards Mt. Doom</a>.</p>",
		'passages': {
		},
	},
	'That\'s when Aragorn\'s ghost army shows up again.': {
		'text': "<p>The army of the dead sweeps through the camp, cutting down orcs{if eaglesComing=1: and bringing down eagles}. They swarm around you like a green ghastly mist, obliterating Mordor&#39;s army at your feet.</p>\n<p>&quot;There, NOW release us from our curse!&quot; the ghost king demands of Aragorn.</p>\n<p>But then the ghost army is vaporized by a blast of immense heat. The Flaming Eye of Sauron, perched atop his tower, fires rays of hellish fire into the undead army. His necromancer abilities overwhelm the power of Aragorn&#39;s sword. The ghost army is no more.</p>\n<p>Chased by the Eye&#39;s laser, <a class=\"squiffy-link link-section\" data-section=\"you rush towards Mt. Doom\" role=\"link\" tabindex=\"0\">you rush towards Mt. Doom</a>.</p>",
		'passages': {
		},
	},
	'you rush towards Mt. Doom': {
		'text': "<p>As you approach the foot of Mt. Doom, the light of Sauron&#39;s eye falls upon you again. Gandalf stands between you and Sauron and casts a force field to block the ray.</p>\n<p>&quot;I will hold off Sauron!&quot; Gandalf shouts as he maintains his magic shield. &quot;Aragorn, take Frodo up the mountain now!&quot; {if fellowship&gt;1:Sam helps lead you along as you ascend the mountain path.} The rest stay behind to fight the incoming Orcs{if eaglesComing=1: and eagles}. </p>\n<p>You hurry <a class=\"squiffy-link link-section\" data-section=\"up the mountain\" role=\"link\" tabindex=\"0\">up the mountain</a>, trying not to <a class=\"squiffy-link link-section\" data-section=\"lag behind\" role=\"link\" tabindex=\"0\">lag behind</a>.</p>",
		'passages': {
		},
	},
	'lag behind': {
		'text': "<p>Aragorn notices you shuffling your feet and hurries back to grab you. He curses your name, and ends up dragging you <a class=\"squiffy-link link-section\" data-section=\"up the mountain\" role=\"link\" tabindex=\"0\">up the mountain</a>. </p>",
		'attributes': ["gandalfAngry+=1"],
		'passages': {
		},
	},
	'up the mountain': {
		'text': "<p>{if gandalfAngry&lt;10:{@gandalfDestroyed=1}}\n{if gandalfAngry&gt;9:{@gandalfDestroyed=0}}</p>\n<p>Gandalf&#39;s shield weakens. The Eye of Sauron quickly overpowers him. His fingers burn as the light&#39;s rays cut through his magic.</p>\n<p>{if gandalfDestroyed=1:Gandalf&#39;s strength gives. He&#39;s given the last of his hope and can fight no longer. He calls out to the Fellowship, &quot;My time is done, friends! Make the most of yours!&quot; and the light of Sauron disintegrates him into ash.}</p>\n<p>{if gandalfDestroyed=0:A glint in Gandalf&#39;s own eyes suddenly gives him renewed strength. &quot;I may falter in your darkness, Sauron, but I have not endured months of traveling with a pain-in-the-arse hobbit named Frodo Baggins to lose to you! Your evil is nothing compared to how wretchedly annoying that feet-dragging, incessantly-whiny, can&#39;t-even-answer-a-damn-door halfling is! You want to spread hatred across Middle-Earth? HAVE A TASTE OF MINE!!!&quot;}</p>\n<p>{if gandalfDestroyed=0:With that, Gandalf&#39;s shield transforms into a powerful ball of spirit energy that travels upwards through Sauron&#39;s light. The spirit blast strikes Sauron&#39;s Eye, blinding the evil tower with a flash of white light. Sauron curses as Gandalf laughs, &quot;Yes! Take that, FRODO! You want some more, FRODO? Of course you do, FRODO!&quot; Sauron insists his name&#39;s not Frodo, but Gandalf&#39;s not listening as he charges up another blast.}</p>\n<p>{if gandalfDestroyed=0:{@sauronDead=1}}</p>\n<p>Meanwhile, <a class=\"squiffy-link link-section\" data-section=\"on top of Mt. Doom...\" role=\"link\" tabindex=\"0\">on top of Mt. Doom...</a></p>",
		'passages': {
		},
	},
	'on top of Mt. Doom...': {
		'text': "<p>Aragorn {if fellowship=1:stands}{if fellowship&gt;1:and Sam stand} behind you as you enter the heart of the volcano and stand on the precipice overlooking the molten pool of fire below.</p>\n<p>&quot;Frodo, <a class=\"squiffy-link link-section\" data-section=\"throw the Ring in!\" role=\"link\" tabindex=\"0\">throw the Ring in!</a>&quot; Aragorn shouts. &quot;Let&#39;s not <a class=\"squiffy-link link-section\" data-section=\"keep the accursed thing\" role=\"link\" tabindex=\"0\">keep the accursed thing</a> any longer!&quot;</p>\n<p>{if fellowship&gt;1:&quot;Please, Mr. Frodo,&quot; Sam begs, &quot;Be done with it and let&#39;s go home!&quot;}</p>\n<p>You give the Ring one last look-over. It&#39;s been a while you last heard its voice. You&#39;ve been so preoccupied with epic battles and horse riding, that only just now does the Ring&#39;s wicked will suddenly call you to again.</p>",
		'passages': {
		},
	},
	'throw the Ring in!': {
		'text': "<p>You toss it into the volcano anyway. After all you&#39;ve been through, the Ring&#39;s will no longer holds you. Your madcap adventures have been significantly more interesting than any power fantasy the Ring could promise.</p>\n<p>The Ring melts in the lava below.</p>\n<p>The volcano erupts. Literally ever Orc in Mordor is killed by falling lava. All of it misses you and your friends. <a class=\"squiffy-link link-section\" data-section=\"You evacuate Mt. Doom immediately.\" role=\"link\" tabindex=\"0\">You evacuate Mt. Doom immediately.</a></p>",
		'passages': {
		},
	},
	'You evacuate Mt. Doom immediately.': {
		'text': "<p>{if lostMinasTirith=0:Long story short, you get saved by the eagles {if eaglesComing=1:(the good ones, not the rogue ones who attacked you) }and taken back to Minas Tirith where Aragorn is crowned King of Gondor and declares you don&#39;t have to bow to anyone. {if fellowship&lt;3:Arwen calls dibs on Aragorn and they get married and adopt Glorfy as their son.} {if fellowship=1:Beorn turns into a giant bear and officiates the wedding himself.}}</p>\n<p>{if lostMinasTirith=1:Long story short, you get saved by the eagles {if eaglesComing=1:(the good ones, not the rogue ones who attacked you) }and taken back to Lothlorien (since Minas Tirith was destroyed.) The Fellowship grabs some brunch, congratulates each other and goes their separate ways.}</p>\n<p>{if boromirDead=0:{if merryPippinInRohan=0:{if lostMinasTirith=1:{if gandalfDestroyed=0:On your way out, Gandalf was able to cast a healing spell on Boromir and save his life. He would go on to help lead the war survivors into Mordor, where Gondor would later expand now that the orcs were all buried under magma.}}}}\n{if boromirDead=0:{if merryPippinInRohan=0:{if lostMinasTirith=1:{if gandalfDestroyed=1:On your way out, you collected Boromir&#39;s body. Gandalf wasn&#39;t around to save him, unfortunately, but the people of Gondor still appreciate what you did.}}}}</p>\n<p>{if gandalfDestroyed=0:Gandalf, weary of Hobbits, leaves with the elves to go across the sea to the Gray Havens, which you assume is some fancy Elvish word for Newfoundland. You&#39;ve never really checked a map to see where it is.}\n{if gandalfDestroyed=1:The people of Gondor make a statue commemorating Gandalf{if boromirDead=1: and Boromir}&#39;s sacrifice and put it in a park. Centuries later, the statue would become the basis for a 2001 Burger King toy.}</p>\n<p>{if eowynLikesYou=0:<a class=\"squiffy-link link-section\" data-section=\"You go back to the Shire.\" role=\"link\" tabindex=\"0\">You go back to the Shire.</a>}\n{if eowynLikesYou=1:<a class=\"squiffy-link link-section\" data-section=\"You head back to Rohan.\" role=\"link\" tabindex=\"0\">You head back to Rohan.</a>}</p>",
		'passages': {
		},
	},
	'You head back to Rohan.': {
		'text': "<p>Now that the War of the Ring is over, you&#39;re eager to meet up with Eowyn again. You feel super-manly after saving Middle-Earth and you want to see where this relationship is headed.</p>\n<p>But it turns out Eowyn suddenly developed a taste for rugged, bearded men after running into King Denethor&#39;s son, Faramir, at the seige of Minas Tirith. By the time you meet them, they&#39;re already talking about manga and holding hands.</p>\n<p>Your heart is broken. <a class=\"squiffy-link link-section\" data-section=\"You go back to the Shire.\" role=\"link\" tabindex=\"0\">You go back to the Shire.</a></p>",
		'passages': {
		},
	},
	'You go back to the Shire.': {
		'text': "<p>You still feel pretty good about this adventure, and are not as soul-drained as you thought you might be. {if fellowship&gt;1:Sam marries a lovely woman named Rosie. You write a not-so-best-selling book.}{if fellowship=1: You honour your fallen friend Sam by marrying his sweetheart, Rosie, and naming your kids Samwell, Samantha, Sambo, and Samus.}{if merryPippinInRohan=1: Merry and Pippin become local sheriffs and enforce their own street justice on the Shire.}{if merryDead=1: You also tell everyone of Merry and Pippin&#39;s tragic deaths, although no one really noticed they were gone.}</p>\n<p>Thus ends your adventure though Middle-Earth, from the Shire to Rohan to Mordor and back again. Good job!</p>\n<p>THE END </p>",
		'passages': {
		},
	},
	'keep the accursed thing': {
		'text': "<p>You slip it on. {if fellowship&gt;1:Sam&#39;s jaw drops.}</p>\n<p>&quot;Frodo! What are you doing?!&quot; Aragorn cries as you turn invisible. You don&#39;t like his tone so you decide to leave. You push him {if fellowship&gt;1:and Sam} aside and head for the exit. You&#39;ve suddenly decided this Ring is yours and the Fellowship has no right to destroy your Precious. {if sauronDead=1:Especially since the Dark Lord has already been destroyed, and Mordor will need a new one.}</p>\n<p>{if sauronDead=1:<a class=\"squiffy-link link-section\" data-section=\"Gandalf then blocks your escape.\" role=\"link\" tabindex=\"0\">Gandalf then blocks your escape.</a>}</p>\n<p>{if sauronDead=0:<a class=\"squiffy-link link-section\" data-section=\"The Eye of Sauron then falls upon you.\" role=\"link\" tabindex=\"0\">The Eye of Sauron then falls upon you.</a>}</p>",
		'passages': {
		},
	},
	'Gandalf then blocks your escape.': {
		'text': "<p>&quot;You think I can&#39;t see you, Frodo?&quot; Gandalf leers at you. &quot;I just ripped the Dark Lord a new one. His evil can no longer hold any power over me, for I&#39;ve discovered a contempt for you far more powerful than any One Ring could contain.&quot;</p>\n<p>You protest that Gandalf is a better door than a window and try to squeeze past him, but Gandalf grabs you by the collar and drags you back into the mountain, kicking and screaming.</p>\n<p>&quot;Step aside, Aragorn, this is personal!&quot; Gandalf bellows as he drags you back to the cliff. &quot;Now throw the Ring in, Frodo! Throw it in before I throw you in!&quot;</p>\n<p>{if fellowship&gt;1:&quot;Leave Mr. Frodo alone!&quot; Sam yells as <a class=\"squiffy-link link-section\" data-section=\"he tackles Gandalf.\" role=\"link\" tabindex=\"0\">he tackles Gandalf.</a>}</p>\n<p>{if fellowship=1:<a class=\"squiffy-link link-section\" data-section=\"You go for his staff.\" role=\"link\" tabindex=\"0\">You go for his staff.</a>}</p>",
		'passages': {
		},
	},
	'he tackles Gandalf.': {
		'text': "<p>All three of you slip and fall over the ledge. Sam grabs onto your hand. Gandalf grabs onto your other hand, his own clutching the Ring tightly as he dangles over the lava.</p>\n<p>&quot;Let it go!&quot; Sam calls out. As you dangle, the Ring slips from your finger, with Gandalf on the other end.</p>\n<p>Gandalf falls into the fires of Mt. Doom, taking the One Ring with him.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue150\" role=\"link\" tabindex=\"0\">Sam pulls you to safety as the volcano erupts.</a></p>",
		'passages': {
		},
	},
	'_continue150': {
		'text': "<p>Aragorn is distraugth at Gandalf&#39;s horrible accident. He is caught unaware as the walls collapse, and he is crushed under a huge boulder.</p>\n<p>You and Sam rush outside, outrunning the lava flow, and take refuge on top of a large boulder. The lava flows past you, trapping you and Sam on the mountainside.</p>\n<p>You watch as the rest of the Fellowship below is engulfed in flames. Your friends die screaming horribly. The rest of Mordor burns. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue151\" role=\"link\" tabindex=\"0\">Only you and Sam remain.</a></p>",
		'passages': {
		},
	},
	'_continue151': {
		'text': "<p>&quot;We did it, Mr. Frodo,&quot; Sam sighs. &quot;That&#39;s the important part. Put everything else out of your mind; we saved Middle-Earth together. That&#39;s all that matters.&quot;</p>\n<p>You drift to sleep with a smile on your face. Yes, you indeed did it. And you should feel proud of what you&#39;ve done.</p>\n<p>Slowly, the lava rises up to wash over you. With the Fellowship gone, and no one left to save you, you embrace your final demise, happy to be with Sam until the end.</p>\n<p>You and Sam vanish among the fires of Mt. Doom. Middle-Earth is now safe, and your tale has come to a close.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'You go for his staff.': {
		'text': "<p>You grab his staff and try to pull Gandalf off the ledge. But the old wizard is stronger than he looks. He pulls the staff from your grip, steps back, and aims its light in your face.</p>\n<p>He sees your cold, soulless eyes. He sees that, in your moment of weakness, the Ring was able to possess you fully. You are Sauron now. You are beyond saving.</p>\n<p>For the first time this whole journey, he feels a pang of empathy for you. A tear rolls down his eye and he whispers, &quot;Frodo...&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue152\" role=\"link\" tabindex=\"0\">You roundhouse Gandalf in the face.</a></p>",
		'passages': {
		},
	},
	'_continue152': {
		'text': "<p>He grabs your leg in mid-air, swings you around and launches you off the cliff.</p>\n<p>You and the Ring falls into the lava below.</p>\n<p>Dying in lava is REALLY bad and possibly the worst imaginable way to die. You&#39;re paralyzed upon striking the molten ore, and your body sputters and squeals as you pop and hiss across the lava like bacon in a frying pan. Gandalf watches you melt into the fires of Mt. Doom, taking the One Ring with you.</p>\n<p>Aragorn cries, &quot;Frodo, oh, nooooo....&quot;</p>\n<p>The volcano erupts, and the last thing you see is the sky as your remains are exploded across the Mordor landscape. You see Middle-Earth one last time before everything becomes dark and silent.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'The Eye of Sauron then falls upon you.': {
		'text': "<p>The Ring&#39;s power is overwhelming. It&#39;s calling all of Mordor towards your location. You know if you stay here, they&#39;ll swarm the mountain and kill you. But you cannot take off your Precious, lest Aragorn find and take it from you.</p>\n<p>You decide you could either <a class=\"squiffy-link link-section\" data-section=\"kill Aragorn\" role=\"link\" tabindex=\"0\">kill Aragorn</a> or <a class=\"squiffy-link link-section\" data-section=\"play with your Precious\" role=\"link\" tabindex=\"0\">play with your Precious</a> some more.</p>",
		'passages': {
		},
	},
	'kill Aragorn': {
		'text': "<p>{if hasSwordAragorn=0:You draw your blade and lunge at Aragorn. But he senses you coming and dodges. His sword rises up and slices your hand clean off. You turn visible and stumble to the ground.}</p>\n<p>{if hasSwordAragorn=0:<a class=\"squiffy-link link-section\" data-section=\"Aragorn boots your hand into the fires below.\" role=\"link\" tabindex=\"0\">Aragorn boots your hand into the fires below.</a>}</p>\n<p>{if hasSwordAragorn=1:You draw the blade you took from Aragorn and lunge at him. He senses you coming, but he&#39;s not prepared for you carrying a longer, more powerful blade. You slash him across the chest and knock him down.}</p>\n<p>{if hasSwordAragorn=1:{if fellowship&gt;1:<a class=\"squiffy-link link-section\" data-section=\"You prepare to finish Aragorn.\" role=\"link\" tabindex=\"0\">You prepare to finish Aragorn.</a>}}</p>\n<p>{if hasSwordAragorn=1:{if fellowship=1:<a class=\"squiffy-link link-section\" data-section=\"And then Beorn shows up.\" role=\"link\" tabindex=\"0\">And then Beorn shows up.</a>}}</p>",
		'passages': {
		},
	},
	'play with your Precious': {
		'text': "<p>You love this Ring so much, you ignore everything around you. The forces of Mordor, Aragorn, the Fellowship... it&#39;s all white noise to you. You pet and lick the Ring, reminding it that you&#39;ll always be there for it.</p>\n<p>Aragorn hears your whispers and slices your hand off with his sword. You turn visible and drop to your knees screaming at your bloody stump.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Aragorn boots your hand into the fires below.\" role=\"link\" tabindex=\"0\">Aragorn boots your hand into the fires below.</a></p>",
		'passages': {
		},
	},
	'Aragorn boots your hand into the fires below.': {
		'text': "<p>The Ring and your hand are destroyed. Aragorn promises you that they&#39;ll get you medical aid, and make you a cool robot hand later (they don&#39;t).</p>\n<p>The volcano begins to erupt.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You evacuate Mt. Doom immediately.\" role=\"link\" tabindex=\"0\">You evacuate Mt. Doom immediately.</a></p>",
		'passages': {
		},
	},
	'You prepare to finish Aragorn.': {
		'text': "<p>Sam throws his frying pan in your direction, striking you in the head with a lucky blow. You drop Aragorn&#39;s sword. It becomes visible as it lands. Both you and Sam dive for it. </p>\n<p>But Aragorn trips you as you run past. You crash into Sam, and Aragorn takes up his sword again. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue153\" role=\"link\" tabindex=\"0\">Suddenly, he and Sam stop attacking.</a></p>",
		'passages': {
		},
	},
	'_continue153': {
		'text': "<p>Wielding the Ring&#39;s power against them, you stand and keep your friends frozen in place. Sauron&#39;s power is now flowing through you. You become visible and Sauron&#39;s will becomes yours.</p>\n<p>Who will live and who will die? You&#39;d like to <a class=\"squiffy-link link-section\" data-section=\"will both friends to fight each other\" role=\"link\" tabindex=\"0\">will both friends to fight each other</a>, but you&#39;d also love to <a class=\"squiffy-link link-section\" data-section=\"do the deed yourself\" role=\"link\" tabindex=\"0\">do the deed yourself</a></p>",
		'passages': {
		},
	},
	'will both friends to fight each other': {
		'text': "<p>Aragorn and Sam try to resist your power, but each take up their weapon and attack one another. Sam deflects Aragorn&#39;s blade, and Aragorn parries his pan. He should be able to kill Sam easily, but it seems he&#39;s still resisting.</p>\n<p>&quot;Frodo!&quot; Sam begs, &quot;You need to stop this!&quot;</p>\n<p>Why would you stop this? You sided with Boromir and chose the Ring&#39;s power long before you arrived. Even claiming Aragorn&#39;s sword was a sign that the Ring would never be enough. </p>\n<p>You&#39;re tired of being a modest Shire hobbit. You want to be a Dark Lord.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue154\" role=\"link\" tabindex=\"0\">An arrow skewers you in the back.</a></p>",
		'passages': {
		},
	},
	'_continue154': {
		'text': "<p>You stumble forward as another arrow plants into you. Legolas stands at the cave entrance, sadness in his heart as he puts you down.</p>\n<p>You stumble towards the cliff face and fall towards the lava. </p>\n<p>Aragorn and Sam reach out and catch you with one hand each. Your dear friends, loving and devoted, still find it in their hearts to forgive and save you.</p>\n<p>But with their other hands, they stab each other.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"All three of you fall into the fires of Mt. Doom.\" role=\"link\" tabindex=\"0\">All three of you fall into the fires of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'do the deed yourself': {
		'text': "<p>You force them towards the cliff face. They willingly surrender themselves to your will and step forward towards the lava.</p>\n<p>Sam begs you, &quot;Please, stop this!&quot;</p>\n<p>Why would you stop this? You sided with Boromir and chose the Ring&#39;s power long before you arrived. Even claiming Aragorn&#39;s sword was a sign that the Ring would never be enough. </p>\n<p>You take Sam&#39;s knife from his hilt and stab him in the back. Then you do the same to Aragorn and wait for them to fall in.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue155\" role=\"link\" tabindex=\"0\">An axe lodges itself in your back.</a></p>",
		'passages': {
		},
	},
	'_continue155': {
		'text': "<p>You stumble forward. Gimli stands at the cave entrance, having thrown his weapon. There is sadness in his heart.</p>\n<p>You stumble towards the cliff face and fall towards the lava. </p>\n<p>Aragorn and Sam reach out and catch you with one hand each. Your dear friends, loving and devoted, still find it in their hearts to forgive and save you.</p>\n<p>But you did stab them, and they&#39;re not strong enough to pull you up.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"All three of you fall into the fires of Mt. Doom.\" role=\"link\" tabindex=\"0\">All three of you fall into the fires of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'All three of you fall into the fires of Mt. Doom.': {
		'text': "<p>Three friends who started this journey all die together, destroying the One Ring that brought them together.</p>\n<p>But in your final moments, you look into each other&#39;s eyes and remember all the good times you shared together. Your meeting in Bree. The craziness on Weathertop. The mountains, the elves, and all that other stuff.</p>\n<p>This is a fine way to die, with the people you love. Obviously, there could be no better ending than this. Not even if one of those endings involved a karaoke party.</p>\n<p>You all smile at one another one last time... and the Ring is destroyed.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'And then Beorn shows up.': {
		'text': "<p>&quot;YOU GET HUGGED BY BEEEEAAAAAARRRRRRR!!!!!&quot; he shouts as he picks you up and traps you in a big bear hug. You struggle and will the bear to release you, but the Ring&#39;s power is nothing compared to that of a giant bear man.</p>\n<p>Aragorn runs forward and forces the Ring off your hand.</p>\n<p>Then, with a mighty hurl, he launches the Ring into the fires of Mt. Doom itself.</p>\n<p>The Ring is destroyed and the volcano erupts.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You evacuate Mt. Doom immediately.\" role=\"link\" tabindex=\"0\">You evacuate Mt. Doom immediately.</a></p>",
		'passages': {
		},
	},
	'Your lone journey into Mordor begins.': {
		'text': "<p>It&#39;s a long, quiet journey to Mordor. You have no one to talk to, and no one to stop you from petting your Ring every five seconds. {if samDrowned=1:Some nights, you dream of Sam&#39;s ghost haunting you, howling &quot;WHYYYYY DID YOU LET ME DROWN, FRODO?!&quot; You hold onto hope that Sam survived the swim and you&#39;ll meet up with him on the way back.}</p>\n<p>You soon arrive near the Gondor bordor and set up camp.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue156\" role=\"link\" tabindex=\"0\">That night, you are awakened by a surprise visitor.</a></p>",
		'attributes': ["frodoAlone = 1","precious+=1"],
		'passages': {
		},
	},
	'_continue156': {
		'text': "<p>A terrifying, half-starved mutant in a loincloth lurks over you, trying to take the Ring. It is the creature GOLLUM, the one whom Uncle Bilbo stole the Ring from years ago.</p>\n<p>&quot;It&#39;s ours! Gives it to us!&quot; he shrieks as he goes for your throat.</p>\n<p>A fight breaks out and he clobbers you with his bare fists, kicking and biting as he goes. You try to protect the Ring, but he wrestles your arms away and rips the chain from your neck.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue157\" role=\"link\" tabindex=\"0\">Gollum takes the Ring and runs off.</a></p>",
		'passages': {
		},
	},
	'_continue157': {
		'text': "<p>Beaten and bruised, you get to your feet and see him racing towards some distant marshes. {if witchKingDanceOff=0:You should probably <a class=\"squiffy-link link-section\" data-section=\"try to go after him\" role=\"link\" tabindex=\"0\">try to go after him</a>, but this is your chance to <a class=\"squiffy-link link-section\" data-section=\"call it quits\" role=\"link\" tabindex=\"0\">call it quits</a> and hope everything sorts itself out.}{if witchKingDanceOff=1:You should probably <a class=\"squiffy-link link-section\" data-section=\"try to chase after him\" role=\"link\" tabindex=\"0\">try to chase after him</a>, but this is your chance to <a class=\"squiffy-link link-section\" data-section=\"call it quits on this nonsense\" role=\"link\" tabindex=\"0\">call it quits on this nonsense</a> and go home.}</p>",
		'passages': {
		},
	},
	'call it quits': {
		'text': "<p>You head back towards the river and look forward to paddling back several miles upstream.</p>\n<p>Then you hear a shriek behind you. From the skies, you see the form of a winged beast descend on Gollum in the distance. It is the WITCH KING, hunting the Ring here in Gondor. You watch as Gollum is attacked and carried into the sky. The beast chomps Gollum into pieces and gobbles him up.</p>\n<p>You take cover as the Witch King soars past. As he does so, a disembodied hand falls from the beast&#39;s jaws and lands next to you. It is Gollum&#39;s hand, still clutching the Ring.</p>\n<p>Even when you call it quits, the Ring still returns to you. The Witch King now  patrols the skies over the river, so you have no choice but to head back east... back into Mordor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue alone towards the Dead Marshes.\" role=\"link\" tabindex=\"0\">You continue alone towards the Dead Marshes.</a></p>",
		'attributes': ["gollumDead = 1"],
		'passages': {
		},
	},
	'try to go after him': {
		'text': "<p>You chase after Gollum over rugged ground, before you&#39;re startled by a shriek from the sky. Descending from above, you see a winged beast with a Black Rider atop it. The WITCH KING heads straight for Gollum.</p>\n<p>You take cover behind a rock and watch as Gollum desperately tries to put on the Ring, screaming, &quot;Savesss us, Precious! Savesss us!&quot;</p>\n<p>The beast dives down scoops up Gollum in its jaws. Gollum is chewed into pieces and swallowed. Satisfied, the Witch King flies away.</p>\n<p>Something small, grey, and bloody lands next to you. It&#39;s Gollum&#39;s disembodied with the Ring in its palm. You take it.</p>\n<p>It seems no matter what, the Ring always comes back to you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You continue alone towards the Dead Marshes.\" role=\"link\" tabindex=\"0\">You continue alone towards the Dead Marshes.</a></p>",
		'passages': {
		},
	},
	'try to chase after him': {
		'text': "<p>You stumble and trip after Gollum trying to keep up, but the creature is fast across these rocks.</p>\n<p>As you climb around some rocks, you are surprised to see Gollum standing with a funny little man. The man is keeping the Ring away from Gollum while Gollum snatches at it furiously.</p>\n<p>&quot;Gives the Precious back! It&#39;s ours! OURS!&quot; Gollum screams.</p>\n<p>&quot;You want it? Go get it!&quot; Tom says, tossing it far away into the distance. Gollum scrambles after it and disappears over a hill.</p>\n<p>The man approaches you. It&#39;s Tom Bombadil! He tosses you the actual Ring.</p>\n<p>&quot;He&#39;ll be busy for a while,&quot; Tom says. &quot;In the meantime, I believe this is yours.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ask what Tom is doing here.\" role=\"link\" tabindex=\"0\">You ask what Tom is doing here.</a></p>",
		'passages': {
		},
	},
	'call it quits on this nonsense': {
		'text': "<p>You begin walking back to the river. You&#39;re done with this stupid journey. Gollum can have his Ring back for all you care. Come to think of it, everything was just fine until Uncle Bilbo stole the Ring from him anyway. Gollum will keep it safe, you&#39;re sure of it.</p>\n<p>Suddenly, you&#39;re startled to see a familiar funny man standing in front of you.</p>\n<p>It&#39;s Tom Bombadil!</p>\n<p>&quot;Lost something?&quot; he asks, tossing you the Ring. &quot;Funny little fellow was running off with it. Thought you might like the dumb thing back.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ask what Tom is doing here.\" role=\"link\" tabindex=\"0\">You ask what Tom is doing here.</a></p>",
		'passages': {
		},
	},
	'You ask what Tom is doing here.': {
		'text': "<p>&quot;I go where I like and whichever way can be found,&quot; he says. &quot;And you, my friend, have certainly lost his way. Excellent ditty on Weathertop, by the way. You certainly gave the Witch King a run for his money. Haven&#39;t heard you sing since, though. What&#39;s wrong with the old pipes?&quot;</p>\n<p>You tell him Gandalf didn&#39;t let you sing on your journey.</p>\n<p>&quot;{if gandalfDead=0:Pah, Gandalf? That old fuddy-duddy?}{if gandalfDead=1:Things might have turned out different with the Balrog if he did, don&#39;t you think?} You need a song in your heart at all times, Frodo! Your Uncle Bilbo and the dwarves sang all the way to Lonely Mountain! He even wrote all the lyrics in his memoirs! Your life is a MUSICAL and you need to live it like that!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue158\" role=\"link\" tabindex=\"0\">He does a short tap-dance and gestures you to follow suit.</a></p>",
		'passages': {
		},
	},
	'_continue158': {
		'text': "<p>You copy his dance moves. The two of you go back and forth until you start feeling the rhythm again.</p>\n<p>&quot;Now, how about you and I <a class=\"squiffy-link link-section\" data-section=\"dance this Ring into Mordor\" role=\"link\" tabindex=\"0\">dance this Ring into Mordor</a>, and <a class=\"squiffy-link link-passage\" data-passage=\"bring a little jazz\" role=\"link\" tabindex=\"0\">bring a little jazz</a> with us?&quot;</p>",
		'passages': {
			'bring a little jazz': {
				'text': "<p>You do jazz hands to show Tom how psyched you are for this.</p>\n<p>&quot;That&#39;s the spirit!&quot; he says.</p>",
			},
		},
	},
	'dance this Ring into Mordor': {
		'text': "<p>Tom takes you down a long yellow brick road towards Mordor. You don&#39;t remember there being a yellow brick road here before, but Tom had no problem finding it. You skip together, arm in arm.</p>\n<p>Tom sings: <I><BR>&quot;We&#39;re off to go to Mordor, <BR>and throw this Ring into a fire! <BR>We&#39;ll party, and dance, and sing, and prance <BR>all the way back to the Shire! <BR>We nary a need for swords and bows, <BR>we&#39;ll carry a tune wherever we goes, <BR>Our prose will take us through the highs and looooooows, <BR>as long as we stay on our dancing toes! <BR>We&#39;re off to go to Mordor, <BR>and throw this Ring into a fiiiiiire!&quot;</I></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue159\" role=\"link\" tabindex=\"0\">You arrive at the Dead Marshes.</a></p>",
		'passages': {
		},
	},
	'_continue159': {
		'text': "<p>You see corpses litter a vast swamp. Tom Bombadil eagerly starts crossing a near-invisible path through the mud. As you follow him, you notice the Ring has almost no weight to it.</p>\n<p>&quot;Care to lead the next song?&quot; Tom asks.</p>\n<p>You debate whether this nasty swamp full of bodies deserves <a class=\"squiffy-link link-section\" data-section=\"a happy song\" role=\"link\" tabindex=\"0\">a happy song</a> or <a class=\"squiffy-link link-section\" data-section=\"some death metal\" role=\"link\" tabindex=\"0\">some death metal</a>.</p>",
		'passages': {
		},
	},
	'a happy song': {
		'text': "<p>You feel like you&#39;re walkin&#39; on sunshine, so sing about that specific subject. Tom gets into your groove as you hop, skip and dance through the mud. All the corpses clap along with your ditty. You have made their sad, cursed afterlife just a little less miserable.</p>\n<p>&quot;That&#39;s what I&#39;m talking about!&quot; Tom says. &quot;Now, onwards to Mordor!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Tom arrive at the Black Gate.\" role=\"link\" tabindex=\"0\">You and Tom arrive at the Black Gate.</a></p>",
		'passages': {
		},
	},
	'some death metal': {
		'text': "<p>You scream some epic, black lyrics across the water. Tom&#39;s startled to hear you go dark with lyrics about knife wounds and eternal torment, but the corpses seem to love it. They raise their lighters out of the water as you cross. You scream and stomp your way through the muddy waters. Tom seems a little deflated.</p>\n<p>&quot;That&#39;s not quite what I meant about keeping a lively step,&quot; Tom says as you cross the swamp. &quot;But who am I to judge? A song is a song! Onwards to Mordor!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Tom arrive at the Black Gate.\" role=\"link\" tabindex=\"0\">You and Tom arrive at the Black Gate.</a></p>",
		'attributes': ["tomAnnoyed+=1"],
		'passages': {
		},
	},
	'You and Tom arrive at the Black Gate.': {
		'text': "<p>You watch as a huge army emerges from two giant gates leading out of the mountain. The gate closes behind them. You suggest finding another way around.</p>\n<p>&quot;Nah, we can get through that gate no problem,&quot; Tom says. &quot;All we need to do is <a class=\"squiffy-link link-section\" data-section=\"disguise ourselves as a travelling dance troupe\" role=\"link\" tabindex=\"0\">disguise ourselves as a travelling dance troupe</a> and the orcs will be lured in by our fresh moves. That&#39;ll work much better than going around or trying something corny like pretending to <a class=\"squiffy-link link-section\" data-section=\"be delivery men\" role=\"link\" tabindex=\"0\">be delivery men</a>.&quot;</p>",
		'passages': {
		},
	},
	'disguise ourselves as a travelling dance troupe': {
		'text': "<p>You like the dance troupe idea.</p>\n<p>&quot;That&#39;s the spirit!&quot; Tom says, ripping his pants off to reveal sparkly red glitter-pants underneath. He reached into a bag and grabs you a pair.</p>\n<p>Tom runs up to the Black Gate, knocks three times, and shouts &quot;GOTTA DAAAAAAANCE!&quot;</p>\n<p>You and him then perform an unrehearsed, but downright outstanding tap-dance routine, complete with stunning footwork, humorous prat-falls, and amazing powerslides. The two of you feel completely in sync.</p>\n<p>The orcs above are delighted and open the gate. One shouts, &quot;Hey, you two! Head on into camp! I think you&#39;ll find something right up your alley.&quot;</p>\n<p>You enter Mordor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass through an orc camp and see a sign.\" role=\"link\" tabindex=\"0\">You pass through an orc camp and see a sign.</a></p>",
		'passages': {
		},
	},
	'be delivery men': {
		'text': "<p>You like that delivery man idea. Tom was just kidding.</p>\n<p>{if tomAnnoyed=0:&quot;I wasn&#39;t serious about that, but... okay.&quot; He sounds disappointed.}\n{if tomAnnoyed=1:&quot;I really, REALLY wanted to do the dance troupe thing, but... okay.&quot; He sounds REALLY disappointed.}</p>\n<p>You find a pile of disposed pizza boxes nearby and take it to the Black Gate, asking to deliver it to Orcy McOrcinorc. It&#39;s a common orc name and the guards on top of the gate are fooled.</p>\n<p>&quot;Looks like meat lover&#39;s back on the menu, boys!&quot; the guards shout as they open the gate.</p>\n<p>You and Tom slip into Mordor and dump the empty boxes somewhere. {if tomAnnoyed=2:Tom says, &quot;Listen, Frodo, I&#39;m starting to get the impression that you aren&#39;t much into happy dancing. But can we please slip in ONE real musical number before we get to Mt. Doom?&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass through an orc camp and see a sign.\" role=\"link\" tabindex=\"0\">You pass through an orc camp and see a sign.</a></p>",
		'attributes': ["tomAnnoyed+=1"],
		'passages': {
		},
	},
	'You pass through an orc camp and see a sign.': {
		'text': "<p>The signs reads: &quot;KARAOKE CONTEST TONITE!&quot;</p>\n<p>The sun&#39;s getting low. Tom squeals, &quot;Please, Frodo? Can we go? Can we go?&quot;</p>\n<p>As fun as it is to <a class=\"squiffy-link link-section\" data-section=\"sing and dance with Tom\" role=\"link\" tabindex=\"0\">sing and dance with Tom</a>, you feel you should probably ignore this karaoke contest and <a class=\"squiffy-link link-section\" data-section=\"go complete your mission instead\" role=\"link\" tabindex=\"0\">go complete your mission instead</a>.</p>",
		'passages': {
		},
	},
	'go complete your mission instead': {
		'text': "<p>You tell Tom it&#39;s time you went to Mt. Doom.</p>\n<p>Tom looks heartbroken. &quot;But I have a whole bunch of songs picked out! Please, PLEASE, come? Don&#39;t <a class=\"squiffy-link link-section\" data-section=\"go to the mountain now\" role=\"link\" tabindex=\"0\">go to the mountain now</a>! We&#39;re having so much fun! I promise you can <a class=\"squiffy-link link-section\" data-section=\"destroy that dumb thing later\" role=\"link\" tabindex=\"0\">destroy that dumb thing later</a>!&quot;</p>",
		'passages': {
		},
	},
	'destroy that dumb thing later': {
		'text': "<p>You decide to <a class=\"squiffy-link link-section\" data-section=\"sing and dance with Tom\" role=\"link\" tabindex=\"0\">sing and dance with Tom</a> after all.</p>\n<p>Tom is ECSTATIC.</p>",
		'passages': {
		},
	},
	'go to the mountain now': {
		'text': "<p>{if tomAnnoyed&lt;3:Tom looks sad. &quot;Fine, go to Mt. Doom. I&#39;ll just go sing by myself. All alone. With no one to duet with. Good luck, Frodo.&quot;}\n{if tomAnnoyed=3:Tom stomps his feet and storms off. &quot;Fine! Go to Mt. Doom! Finish your quest! I thought you were special, but you don&#39;t want to sing happy songs or dance! I&#39;ll go karaoke by myself! And I&#39;ll have fun and martinis without you!&quot;}</p>\n<p>{if tomAnnoyed=3:Nice job, Frodo. You broke Tom Bombadil.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue160\" role=\"link\" tabindex=\"0\">You head off to destroy the Ring.</a></p>",
		'attributes': ["tomAnnoyed+=1"],
		'passages': {
		},
	},
	'_continue160': {
		'text': "<p>An hour later, you&#39;ve arrived at Mt. Doom. The Ring is feeling heavier now, but it&#39;s felt like that ever since you parted ways with Tom. {if tomAnnoyed=3:In fact, it&#39;s been extra-heavy since Tom stormed off.}</p>\n<p>You see a cave leading into the volcano. You suppose it&#39;s time to <a class=\"squiffy-link link-section\" data-section=\"enter the volcano\" role=\"link\" tabindex=\"0\">enter the volcano</a> and finish this, but there&#39;s still time to <a class=\"squiffy-link link-section\" data-section=\"go back and sing with Tom\" role=\"link\" tabindex=\"0\">go back and sing with Tom</a> if you want.</p>",
		'passages': {
		},
	},
	'enter the volcano': {
		'text': "<p>You climb the mountain, enter the cave and discover a cliff overlooking a pit of lava. You&#39;ve finally arrived at the fires of Mordor. You hope Tom will forgive you for this.</p>\n<p>You take the Ring off from around your neck and hold it over the pit. It&#39;s time to <a class=\"squiffy-link link-section\" data-section=\"drop it in and be done with this\" role=\"link\" tabindex=\"0\">drop it in and be done with this</a>.</p>\n<p>{if tomAnnoyed&lt;3:The Ring calls to you, but its sway is no longer powerful enough to tempt you. It&#39;s just a chunk of jewelry now.}\n{if tomAnnoyed=3:But the Ring&#39;s power calls to you. Suddenly, it&#39;s begging you to <a class=\"squiffy-link link-section\" data-section=\"wear it more than ever\" role=\"link\" tabindex=\"0\">wear it more than ever</a>. It&#39;s very difficult to resist.}</p>",
		'passages': {
		},
	},
	'drop it in and be done with this': {
		'text': "<p>You drop the Ring into the mountain. The Ring melts into the lava and vanishes.</p>\n<p>The Ring is destroyed. The volcano gurgles and burps, but does not erupt.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue161\" role=\"link\" tabindex=\"0\">You leave the cave and return to the orc camp.</a></p>",
		'passages': {
		},
	},
	'_continue161': {
		'text': "<p>Karaoke is over. You see Tom sitting on a stage. He&#39;s singing a sad, old song about country roads taking him home. Most of the audience has cleared out. He tells you that he lost the contest to some drunken frat orcs.</p>\n<p>{if tomAnnoyed&lt;3:&quot;I&#39;m not sad anymore,&quot; he says. &quot;I&#39;m glad you did what you did.&quot;}\n{if tomAnnoyed=3:&quot;I&#39;m not mad anymore,&quot; he says. &quot;I understand why you did what you did.&quot;}</p>\n<p>You explain that you had put your mission first. A lot of your hobbit friends died over this Ring.{if gandalfDead=1: And then Gandalf died.} So many people in Middle-Earth died and are probably still dying.</p>\n<p>&quot;Nah,&quot; Tom smirks. &quot;The orcs aren&#39;t going to war anymore. Ever since the Witch King bit it at Weathertop, most of Mordor has lost its fighting spirit. Even the big flaming eye closed a while ago.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue162\" role=\"link\" tabindex=\"0\">Tom ushers you out of camp.</a></p>",
		'passages': {
		},
	},
	'_continue162': {
		'text': "<p>You both find a nice rock to sit on as the sun sets.</p>\n<p>Tom speaks solemnly, &quot;Ages ago, I met a woman outside Hobbiton. We fell in love and tried to start a family. But my passion for music drove her away. I couldn&#39;t be the father my child deserves. So she told my only son I drowned in the Brandybuck River.&quot;</p>\n<p>Tom looks at you with tears in his eyes. &quot;Like all magical beings, I&#39;ve been living on borrowed time for ages. Tonight was my last night. And I&#39;m glad that when it came down to it, you chose duty over a carefree life. You&#39;re a good boy, Frodo. You&#39;re every bit your mother, and thankfully, none of your father.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue163\" role=\"link\" tabindex=\"0\">Tom starts to fade away magically.</a></p>",
		'passages': {
		},
	},
	'_continue163': {
		'text': "<p>He collapses into your arms and calls you son one last time.</p>\n<p>You sing to him until he&#39;s gone for good.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue164\" role=\"link\" tabindex=\"0\">The sun sets.</a></p>",
		'passages': {
		},
	},
	'_continue164': {
		'text': "<p>A month later, you&#39;re back in Hobbiton.</p>\n<p>The Fellowship disbanded after the war ended and went their separate ways.{if gandalfDead=1: Thankfully, it turns out Gandalf survived his fall.}{if boromirDead=1: Unfortunately, Boromir passed away at Amon Hen after being attacked by orcs.}</p>\n<p>Gandalf comes to visit you from time to time, but he&#39;s still miffed that you travelled with Tom instead of him. You feel he knew Tom&#39;s secret all along and despised him for it. You can&#39;t imagine living with that kind of salt inside.</p>\n<p>You like to imagine that when you destroyed the Ring, Tom&#39;s spirit kept it from destroying Mordor. He believed in the best of people and you should too.</p>\n<p>You set the Light of Galadriel on your mantle as a reminder of him.</p>\n<p>And then you make yourself {if jam=0:a cup of tea}{if jam=1:some toast with jam} because you deserve it.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'wear it more than ever': {
		'text': "<p>The Ring inches closer to your finger. It doesn&#39;t seem to be stopping.</p>\n<p>&quot;That&#39;s enough, Frodo!&quot; you hear Tom Bombadil shout from the cave. You spin to face him. &quot;I sensed the Ring would overwhelm you. I&#39;m sorry I didn&#39;t say something sooner. I thought you might be... stronger.&quot;</p>\n<p>You tell Tom the Ring is yours and slip it on, but Tom sees through its power. Before you can run past him, he trips you and pulls the Ring from your finger.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue165\" role=\"link\" tabindex=\"0\">You fly into a berseker rage and attack Tom.</a></p>",
		'passages': {
		},
	},
	'_continue165': {
		'text': "<p>Tom easily dodges and weaves around you. You stumble past and almost fall off the cliff, but Tom grabs your cloak and pulls you back.</p>\n<p>&quot;This is not you, Frodo,&quot; he says. &quot;Don&#39;t let some fanciful notion of power cloud your mind. You&#39;re meant for better things than this.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue166\" role=\"link\" tabindex=\"0\">The volcano quakes and Tom loses his footing.</a></p>",
		'passages': {
		},
	},
	'_continue166': {
		'text': "<p>You reach out to grab the Ring, but Tom holds onto it. You end up grabbing his sleeve, ordering him to relinquish the Ring as he dangles over the cliff.</p>\n<p>Tom says, &quot;I&#39;m sorry, Frodo. I see it in you now. There&#39;s no song left in you. If it&#39;s lost from you, then it&#39;s lost from Middle-Earth. And a Middle-Earth without a song is one... without Tom Bombadil. Farewell.&quot;</p>\n<p>He slips out of his jacket and falls into the fires below.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue167\" role=\"link\" tabindex=\"0\">The Ring, and Tom Bombadil, are destroyed.</a></p>",
		'passages': {
		},
	},
	'_continue167': {
		'text': "<p>The volcano erupts. You run from the cave and down the mountain side. The volcano erupts even more powerfully, as if suffering from indigestion. Destroying the Ring was one thing, but destroying Tom Bombadil might be the worst possible thing to ever happen.</p>\n<p>The ground opens up across Mordor, swallowing up hordes of orcs. The tower of Barad-dûr explodes, taking the Eye of Sauron with it. Then you see eagles flying in to rescue you, with Gandalf atop one of them{if gandalfDead=1:, back from the dead}. But the fire from the mountain erupts, taking out all the eagles across the sky. Gandalf is killed{if gandalfDead=1: yet again}.</p>\n<p>The destruction reigns across Middle-Earth. The mountain around Mordor crumble into the ground. The great cities of Gondor and Rohan are destroyed. The Misty Mountains are in ruin. Rivendell is shattered. Hobbiton is aflame.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue168\" role=\"link\" tabindex=\"0\">Middle-Earth is destroyed.</a></p>",
		'passages': {
		},
	},
	'_continue168': {
		'text': "<p>Years later, you&#39;re in a tavern in Bree. Time hasn&#39;t been good to you since the apocalypse. You&#39;re now a steady alcoholic with a bum leg and an eyepatch. Every night, you can be found at this bar, reflecting on the time you got Tom Bombadil killed.</p>\n<p>Aragorn, Legolas and Gimli approach you. Time hasn&#39;t been good to them either. Each one is riddled in scars and missing at least two appendages. Beorn didn&#39;t survive, and now Gimli wears his bear pelt as a memento.</p>\n<p>&quot;It&#39;s time to go, Frodo,&quot; Aragorn says. &quot;The dead are on the move.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue169\" role=\"link\" tabindex=\"0\">It should be mentioned you&#39;re living in a zombie apocalypse now.</a></p>",
		'passages': {
		},
	},
	'_continue169': {
		'text': "<p>The dead started rising after you killed Tom Bombadil. Now the hordes wander the land, ravaging the forests and towns. They&#39;ll be in Bree soon.</p>\n<p>Arwen and Glorfy are at the reigns of the battle-wagon, preparing to evacuate. You hop in the back and see the zombie horde in the distance approaching slowly. You man the mounted ballista and prepare to defend yourself on the journey.</p>\n<p>&quot;They say Carn Dum has been cleared out,&quot; Legolas says. &quot;We could resettle there for a while.&quot;</p>\n<p>&quot;Then head north,&quot; Aragorn says as you head into the cold wastes.</p>\n<p>You load your weapon and settle in for the long, songless ride ahead. </p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'go back and sing with Tom': {
		'text': "<p>Meanwhile, Tom sings for a gathering of orcs on stage. The crowd jeers as he awkwardly sings &quot;Dancing Queen&quot;, but his voice cracks and his eyes are in tears. His spirit is broken.</p>\n<p>He stops singing partway through and sighs sadly.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue170\" role=\"link\" tabindex=\"0\">And then a miracle happens.</a></p>",
		'passages': {
		},
	},
	'_continue170': {
		'text': "<p>A spotlight lands on you in the back of the crowd. The band begins a new song at your request: &quot;Come Sail Away&quot; by Styx, and you serenade Tom with its sweet melody as you approach him through the crowd.</p>\n<p>&quot;You came,&quot; he sobs with joy, &quot;I knew you would.&quot;</p>\n<p>He jumps on his lines and sings back to you. The two of you meet in the middle of the crowd and embrace one another during the instrumental break.</p>\n<p>You tell Tom you couldn&#39;t leave him alone. Not without finishing the song you started together.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue171\" role=\"link\" tabindex=\"0\">&quot;Then let&#39;s finish this,&quot; Tom says.</a></p>",
		'passages': {
		},
	},
	'_continue171': {
		'text': "<p>As the song kicks into high gear, the entire crowd gets in on the action, waving their torches in the air, singing:</p>\n<p><I>&quot;Come sail away!<BR>Come sail away!<BR>Come sail away with me!&quot;</I><BR></p>\n<p>You and Tom win the karaoke contest hands down with the greatest performance of all time. There&#39;s not a dry eye in the house.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue172\" role=\"link\" tabindex=\"0\">In the morning, Tom is gone.</a></p>",
		'passages': {
		},
	},
	'_continue172': {
		'text': "<p>You wake up in a tent to find he left you a note:</p>\n<p>&quot;Frodo, I haven&#39;t long for this world, and I&#39;m glad you came back to sing with me one last time. Since your journey began, you were reluctant to leave your home, but your voice took you beyond the wars of Middle-Earth. You found new purpose in this world and came full-circle to embrace it. You are now the master of your own destiny. For you, the only Ring of Power is your own Circle of Life. </p>\n<p>&quot;You have learned the ultimate song. Now go forward, Frodo, and spread your message. Sing... and become the new Tom Bombadil this world deserves.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue173\" role=\"link\" tabindex=\"0\">&quot;Sing of the great CIRCLE OF LIFE.&quot;</a></p>",
		'passages': {
		},
	},
	'_continue173': {
		'text': "<p>You do just that as you march out of the orc camp and towards Mt. Doom.</p>\n<p>Your voice echoes over the plains as the sun rises. All the orcs and goblins awaken to a new day and begin following you in large herds. Soon, oliphaunts, wargs, and caragors emerge from the wild and join your procession. Then antelopes, zebras and rhinos come out of nowhere too. The entirety of Mordor has your back as you ascend the mountain.</p>\n<p>Mid-song, you arrive at the edge of the volcano.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue174\" role=\"link\" tabindex=\"0\">You waste no time throwing the Ring into the fire.</a></p>",
		'passages': {
		},
	},
	'_continue174': {
		'text': "<p>As the Ring is destroyed, the volcano erupts with showers of harmless glitter. Rainbows appear across the sky and all the denizens of Mordor bow before you. A large orc picks you up and holds you out to your adoring public.</p>\n<p>Sauron&#39;s tower harmlessly pops out of existence, leaving no trace.</p>\n<p>Mordor is free once more. There will be no war in Middle-Earth.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue175\" role=\"link\" tabindex=\"0\">You return home.</a></p>",
		'passages': {
		},
	},
	'_continue175': {
		'text': "<p>You later find out the Fellowship is alive and well.{if gandalfDead=1: Even Gandalf, who somehow survived his fall in Moria.} They took care of that Saruman problem, and finding no war in Mordor, disbanded.{if gandalfDead=0: Boromir went home, saddened that he drove you away, but you forgive him and teach him a happy, whistling tune as a peace offering.} You also give the Fellowship the extra shampoo you got from Lothlorien as a parting gift.</p>\n<p>Gandalf escorts you home, but your constant singing drives him a little mad. Now that you&#39;re the &quot;new Tom Bombadil&quot;, everything about you grates on him. You&#39;re no longer bound by the old laws and practices of Middle-Earth, and Gandalf can&#39;t even use his magic to shut you up.</p>\n<p>You resettle back into Hobbiton and part ways with Gandalf.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue176\" role=\"link\" tabindex=\"0\">And that&#39;s the end of your magical music tour.</a></p>",
		'passages': {
		},
	},
	'_continue176': {
		'text': "<p>You never learn what became of Tom Bombadil, but you feel he left you a gift unlike any other. You now move freely through Middle-Earth on a whim and return home anytime you like without cause for concern. This world is your playground and you are its legend. </p>\n<p>You are Frodo, Master of the great Circle of Life.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'sing and dance with Tom': {
		'text': "<p>You arrive at a large gathering of orcs who are surprisingly welcoming to your appearance. At first, you think it has something to do with Tom, but they start chanting your name instead.</p>\n<p>&quot;It&#39;s the halfing that did done in the Witch King!&quot;</p>\n<p>&quot;Sing us another another tune, little one!&quot;</p>\n<p>&quot;All hail Frodo, King of Weathertop!&quot;</p>\n<p>They explain that since you defeated the Witch King with the power of song, all the Black Riders retreated back to Sauron&#39;s tower in shame, and the orcs lost all interest in war. Now they&#39;ve pulled back their troops from Rohan and Gondor and are refocusing their efforts on music. They want to be ready for the next big Middle-Earth dance-off.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue177\" role=\"link\" tabindex=\"0\">A small five-Orc party approaches you.</a></p>",
		'passages': {
		},
	},
	'_continue177': {
		'text': "<p>&quot;Arrr!&quot; their scarred leader says, &quot;We be the Kurrauz-Ud Boys! You fancy a little competition? Our team versus you two!&quot;</p>\n<p>&quot;Oh, it&#39;s ON!&quot; Tom exclaims. &quot;What should our team name be, Frodo? Wanna go with <a class=\"squiffy-link link-section\" data-section=\"enterTeamName, teamName=Kings of Weathertop\" role=\"link\" tabindex=\"0\">Kings of Weathertop</a>, <a class=\"squiffy-link link-section\" data-section=\"enterTeamName, teamName=Brandybuck Buddies\" role=\"link\" tabindex=\"0\">Brandybuck Buddies</a>, or <a class=\"squiffy-link link-section\" data-section=\"enterTeamName, teamName=Fart Party\" role=\"link\" tabindex=\"0\">just something stupid</a>?</p>",
		'passages': {
		},
	},
	'enterTeamName': {
		'text': "<p>&quot;Ok, sounds good,&quot; Tom says as he grabs a song card and pencils in &quot;{teamName}&quot;.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue178\" role=\"link\" tabindex=\"0\">The competition begins.</a></p>",
		'passages': {
		},
	},
	'_continue178': {
		'text': "<p>CONCERNING KARAOKE IN MIDDLE-EARTH</p>\n<p>Over the years, wizards in Middle-Earth have meddled with clairvoyancy and visions. As a result, they&#39;ve collected a fair bit of licensed music from distant times and sold the songs to any passing minstrel with enough coin. Of course, the minstrels would never play the songs exactly as we do, but the songs would still go on to become tavern hits. People in Middle-Earth still go just as crazy over Journey&#39;s &quot;Don&#39;t Stop Believing&quot; as we do, even if it doesn&#39;t sound the same.</p>\n<p>On that note, an orc named Bardh-Art signs up for the competition and opens up the show with that exact song -- and completely butchers it. Tom scratches it off his &#39;to-sing&#39; list.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue179\" role=\"link\" tabindex=\"0\">The contest continues.</a></p>",
		'passages': {
		},
	},
	'_continue179': {
		'text': "<p>The Kurrauz-Ud Boys are next up on stage, performing their signature song, &quot;Kurrauz-Ud&#39;s Back, All Right!&quot; They&#39;ve got all the freshest moves and are completely winning the crowd over from the start.</p>\n<p>&quot;Don&#39;t let them intimidate you,&quot; Tom says. &quot;Karaoke&#39;s all about warming up the crowd first. Win them over in your second song, and knock them down with your third. That said, which of these songs do you feel we should perform?</p>\n<p>Tom shows you his list. Two catch your eye: The cheesy pop-rock tune by Cheap Trick, &quot;<a class=\"squiffy-link link-section\" data-section=\"I Want U 2 Want Me\" role=\"link\" tabindex=\"0\">I Want U 2 Want Me</a>&quot;, or Franky Sinatra&#39;s lounge classic, &quot;<a class=\"squiffy-link link-section\" data-section=\"My Waaaay\" role=\"link\" tabindex=\"0\">My Waaaay</a>&quot;.</p>",
		'passages': {
		},
	},
	'I Want U 2 Want Me': {
		'text': "<p>Going cheesy pop-rock is a good choice. It&#39;s a fun, familiar tune, and the crowd is totally onboard with the hobbit and funny little man who just showed up. You feel their love and admiration as you bounce around on stage and even get a little sing-along happening near the end.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Round two begins!\" role=\"link\" tabindex=\"0\">Round two begins!</a></p>",
		'attributes': ["karaokeWin+=1"],
		'passages': {
		},
	},
	'My Waaaay': {
		'text': "<p>Going lounge turns out not to be a great choice. As much as people like this song, you shouldn&#39;t open a set with it. This is a song better saved for late-night, when everyone&#39;s much drunker. You&#39;ve slightly lowered the buzz in this room with your song choice. They still like the performance, though, and you get a smattering of golf claps.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Round two begins!\" role=\"link\" tabindex=\"0\">Round two begins!</a></p>",
		'passages': {
		},
	},
	'Round two begins!': {
		'text': "<p>Now Bardh-Art&#39;s singing &quot;Misty Mountain Hop&quot;, just to be funny. The crowd thinks the song choice is a little on-the-nose. They also don&#39;t appreciate his sunglasses.</p>\n<p>It&#39;s the Kurrauz-Ud Boys&#39; turn to be funny as they go up and sing &quot;Dwarvish Paradise&quot;, a parody song by the bard Weird Elf Yankovic. The crowd eats it up. Even a couple dwarves in company are having a good laugh at it.</p>\n<p>You find another Weird Elf song you like called &quot;<a class=\"squiffy-link link-section\" data-section=\"Livin' La Vida Laketown\" role=\"link\" tabindex=\"0\">Livin&#39; La Vida Laketown</a>&quot; which might also be funny. But a popular club song catches your eye, &quot;<a class=\"squiffy-link link-section\" data-section=\"Party-Rock Anthem\" role=\"link\" tabindex=\"0\">Party-Rock Anthem</a>&quot; and you wonder if the crowd would rather go higher-energy instead.</p>",
		'passages': {
		},
	},
	'Livin\' La Vida Laketown': {
		'text': "<p>You regret your decision to follow-up with the same artist. People like the song all right, but they were eager for something different and now you&#39;re just turning this into a clown show. The only person really excited for your song choice is Bardh-Art.</p>\n<p>{if karaokeWin=0:&quot;This is getting nasty, Frodo,&quot; Tom says. &quot;We&#39;ll need to bust out the big guns.&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Round three begins!\" role=\"link\" tabindex=\"0\">Round three begins!</a></p>",
		'passages': {
		},
	},
	'Party-Rock Anthem': {
		'text': "<p>Party-rocking is the right choice. The crowd&#39;s already had some drinks, some laughs, and now they&#39;re ready to get shufflin&#39;. They groove along with your rapping as you and Tom pass the song back and forth and put everyone in an even better mood.</p>\n<p>{if karaokeWin=2:&quot;We&#39;re doing it, Frodo!&quot; Tom says. &quot;Another performance like that and we&#39;ve got this contest in the bag!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Round three begins!\" role=\"link\" tabindex=\"0\">Round three begins!</a></p>",
		'attributes': ["karaokeWin+=1"],
		'passages': {
		},
	},
	'Round three begins!': {
		'text': "<p>Bardh-Art starts singing the 19-minute extended version of &quot;My Heart Will Go On&quot;. He is killed as the crowd rushes the stage and tears him in half. </p>\n<p>After the stage is mopped up, the Kurrauz-Ud Boys try to lift people&#39;s spirits with their own rendition of &quot;Proud Mary&quot;. It&#39;s an exciting energetic experience as each orc takes turns singing the one-person song about riverboats, but Tom seems unimpressed.</p>\n<p>&quot;They&#39;re drunk and stepping on each other&#39;s lines,&quot; he says. &quot;Plus the crowd&#39;s too tired for party hits. We need harmony. Something personal this crowd can enjoy without too much investment.&quot;</p>\n<p>He motions you to pick the last song. He&#39;s opting for either the cheesy love-duet, &quot;<a class=\"squiffy-link link-section\" data-section=\"Total Eclipse of the Heart\" role=\"link\" tabindex=\"0\">Total Eclipse of the Heart</a>&quot; or the lengthy group singalong, &quot;<a class=\"squiffy-link link-section\" data-section=\"Hi Jude\" role=\"link\" tabindex=\"0\">Hi Jude</a>&quot;.</p>",
		'passages': {
		},
	},
	'Total Eclipse of the Heart': {
		'text': "<p>You opt for the love duet and completely knock it out of the park.</p>\n<p>The entire crowd is totally into you and Tom belting out this power ballad as you circle one another. You see torches go into the air during the instrumental solo, and hold up the Light of Galadriel to enthral the crowd further. </p>\n<p>{if karaokeWin=3:This is your shining moment.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The contest ends and the crowd has spoken.\" role=\"link\" tabindex=\"0\">The contest ends and the crowd has spoken.</a></p>",
		'attributes': ["karaokeWin+=1"],
		'passages': {
		},
	},
	'Hi Jude': {
		'text': "<p>You regret choosing the lengthy song. As excited as the crowd is at first, it seems everyone forgets that the last four minutes of this song are just &quot;Na na na naaaa&quot; on repeat. Many lose interest in this time and head off to the bathroom to drain their bladders.</p>\n<p>{if karaokeWin=0:Tom sighs.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The contest ends and the crowd has spoken.\" role=\"link\" tabindex=\"0\">The contest ends and the crowd has spoken.</a></p>",
		'passages': {
		},
	},
	'The contest ends and the crowd has spoken.': {
		'text': "<p>The contest host, a large, disfigured orc with a metal shard stuck in his skull, steps up and tells the crowd to cheer for the winners. After tallying up the crowd applause, he makes his decision.</p>\n<p>{if karaokeWin=0:&quot;The winners, by a LANDSLIDE, are the Kurrauz-Ud Boys!&quot;}</p>\n<p>{if karaokeWin=1:&quot;The winners are our hometown heroes... the Kurrauz-Ud Boys!&quot;}</p>\n<p>{if karaokeWin=2:&quot;The winners, by an inch... are the Kurrauz-Ud Boys!&quot;}</p>\n<p>{if karaokeWin=3:&quot;The winners, giving us the best show Mordor has ever seen... {teamName}!&quot;}</p>\n<p>{if karaokeWin&lt;3:<a class=\"squiffy-link link-section\" data-section=\"The Kurrauz-Ud Boys run up on stage.\" role=\"link\" tabindex=\"0\">The Kurrauz-Ud Boys run up on stage.</a>}\n{if karaokeWin=3:<a class=\"squiffy-link link-section\" data-section=\"You and Tom run up on stage!\" role=\"link\" tabindex=\"0\">You and Tom run up on stage!</a>}</p>",
		'passages': {
		},
	},
	'The Kurrauz-Ud Boys run up on stage.': {
		'text': "<p>Their leader calls out, &quot;Thanks, Mordor, but we wouldn&#39;t be here tonight if it weren&#39;t for our special guests. {teamName}, get up here!{if karaokeWin=0: You sang a god-awful set tonight, so you&#39;re not leaving until we rectify that!}&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Tom run up on stage!\" role=\"link\" tabindex=\"0\">You and Tom run up on stage!</a></p>",
		'passages': {
		},
	},
	'You and Tom run up on stage!': {
		'text': "<p>{if karaokeWin=3:&quot;Thank you, Mordor!&quot; Tom calls out. &quot;We wouldn&#39;t be here tonight if it weren&#39;t for little Frodo here learning to find his inner voice. And a special shout-out to the Kurrauz-Ud Boys - you put on a spectacular show! Now get up here and let&#39;s all sing!&quot;}</p>\n<p>You, Tom and Kurrauz-Ud Boys bust out a fantastic rendition of &quot;Bohemian Rhapsody&quot; and proceed to sing the complete works of Queen throughout the night. The orcs buy you tons of drinks. You and Tom get progressively drunker as you celebrate.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue180\" role=\"link\" tabindex=\"0\">Morning comes.</a></p>",
		'passages': {
		},
	},
	'_continue180': {
		'text': "<p>Your Ring is missing.</p>\n<p>&quot;What, that thing?&quot; one of the boys ask. &quot;We done destroyed it last night. You was probably too drunk to remember. We all marched up the mountain, lobbed it in the lava, and spat on it. The Ring&#39;s no more!&quot;</p>\n<p>You ask if anything terrible happened when the Ring melted, and they point out that Sauron&#39;s tower is now gone, having exploded into a million pieces. In fact, all of Sauron&#39;s followers were conveniently destroyed along with it. Only the karaoke orcs survived.</p>\n<p>&quot;You did it,&quot; Tom says. &quot;You saved Middle-Earth! All hail Frodo!&quot;</p>\n<p>{if karaokeWin=3:&quot;All hail Frodo!&quot; Mordor shouts. &quot;King of Karaoke!&quot;}</p>\n<p>You all sing &quot;We are the Champions&quot; to celebrate.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue181\" role=\"link\" tabindex=\"0\">And then you go home.</a></p>",
		'passages': {
		},
	},
	'_continue181': {
		'text': "<p>Tom doesn&#39;t come with you. He tells you his time left in Middle-Earth is short, and you no longer need his company because you are master of your own world now.</p>\n<p>&quot;When this journey began, you refused to leave your home. But the truth is that you ended this war back on Weathertop without violence, and the rest of your journey has shaped you into the hobbit you were meant to be. This was never about the Fellowship; you made this YOUR story. Now go home and share it with everyone.&quot;</p>\n<p>And of course, the Shire is delighted to see you. You learn the Fellowship is alive and well{if gandalfDead=1:, including Gandalf who miraculously survived his fall}. They defeated Saruman quite easily at his own tower and then disbanded since there was no longer a threat from Mordor. </p>\n<p>After you resettle, you decide to start your own karaoke club and be a regular MC for Hobbiton. {if karaokeWin=3:Of course, your legendary status as &#39;King of Karaoke&#39; brings in people from Middle-Earth over just to compete with the master. You unite the land and bring more peace through music than any other path you could have followed.} Aragorn, Legolas and Gimli are regulars and can belt out a pretty mean &quot;Billie Jean&quot;.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue182\" role=\"link\" tabindex=\"0\">You never see Tom again.</a></p>",
		'passages': {
		},
	},
	'_continue182': {
		'text': "<p>Some nights, you look up at the stars and wonder what become of that funny little man. The one who guided you to Bree, taught you to sing, and brought peace to Middle-Earth through his mirth. There are many secrets lost in this land, and none are more mysterious than the legend of Tom Bombadil, where he came from, and his ultimate divine purpose.</p>\n<p>Whatever his great plan was, you&#39;re grateful to have been part of it.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'You continue alone towards the Dead Marshes.': {
		'text': "<p>You arrive at a swamp filled with dead bodies and burning pockets of swamp gas. After walking for a few minutes, you get stuck in the mud and immediately sink into the water.</p>\n<p>You&#39;re certain this is certain death, but then the bodies in the water come to life. They start pushing and prodding you back towards the surface.</p>\n<p>You scramble onto shore, wet and muddy. Glaring around, you see the dead poking their heads up through the water, glaring at your Ring. It feels hot around your neck. Moments later, they disappear into the water.</p>\n<p>{if eaglesComing=0:<a class=\"squiffy-link link-section\" data-section=\"You cross the swamp without another incident.\" role=\"link\" tabindex=\"0\">You cross the swamp without another incident.</a>}</p>\n<p>{if eaglesComing=1:<a class=\"squiffy-link link-section\" data-section=\"Then you hear another screech from above.\" role=\"link\" tabindex=\"0\">Then you hear another screech from above.</a>}</p>",
		'passages': {
		},
	},
	'Then you hear another screech from above.': {
		'text': "<p>Rolling over, you see a flock of large brown birds soaring overhead. Your heart skips a beat and you realize THE EAGLES ARE COMING.</p>\n<p>But then you realize the one in the lead is the same scarred one you saw back at Caradhras. And it doesn&#39;t look like it&#39;s searching for you... it looks like it&#39;s hunting.</p>\n<p>You roll back into the mud and hide. The dead try to push you back out, but you manage to stay low long enough to hear the eagle speak your tongue.</p>\n<p>&quot;He&#39;ll be around here somewhere! Find the halfling before it takes the Ring to Mordor!&quot;</p>\n<p>The eagles fly away and you crawl out of the mud. It seems seeing the Ring on the mountain has attracted the attention of the eagles as well. You&#39;ll need to steer clear of these ones.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You cross the swamp without another incident.\" role=\"link\" tabindex=\"0\">You cross the swamp without another incident.</a></p>",
		'passages': {
		},
	},
	'You cross the swamp without another incident.': {
		'text': "<p>{if merryDead=1:{if pippinDead=1:{if gandalfDead=1:{if bilboDead=1:{if samDrowned=1:{@friendsDead=5}}}}}} </p>\n<p>After days of travel, you continue to feel faint from the Ring&#39;s weight once more. As you stumble and fall, you think you hear a ghostly voice on the wind. </p>\n<p>&quot;Frodo, you&#39;ve suffered a great betrayal{if friendsDead=5: and devastating losses}. You&#39;ve chosen to abandon your friends and journey into Mordor alone. But even here, you are not alone. There are still many paths for you into Mordor.&quot;</p>\n<p>{if eaglesComing=1:&quot;Be wary of the Dark Fortress and Black Gate, for the eagles guard these paths and there are few among them strong-hearted enough to aid you. There are also soldiers of Gondor who defend these borders and may help if you put your faith in them.&quot;}</p>\n<p>{if eaglesComing=0:&quot;If you can make it to the Dark Fortress, I will come to your aid. But if the path is dangerous, seek out the soldiers of Gondor who defend these borders and put your trust in a familiar face.&quot;}</p>\n<p>{if precious&lt;6:&quot;You&#39;ve resisted the Ring long enough; if you continue being strong, you will prevail.&quot;}</p>\n<p>{if precious&gt;5:&quot;The Ring&#39;s power is slowly seizing you. If you don&#39;t hold true, its power will prevail. You must endure, Frodo.&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue183\" role=\"link\" tabindex=\"0\">The voice vanishes without an explanation, and you journey on.</a></p>",
		'attributes': ["friendsDead = 0"],
		'passages': {
		},
	},
	'_continue183': {
		'text': "<p>After days of travel, you arrive at the bordor of Mordor. At this point, you&#39;re lost, confused, hungry, thirsty, messy, smelly, and overall miserable. You&#39;re happy to see the horrible Black Gate at long last, and not just more annoying rocks. </p>\n<p>Unfortunately, the Black Gate is surrounded by mountains on both sides and seems to be the only way into the land.</p>\n<p>As an army emerges from the Black Gate and heads into Gondor, you realize this is your chance to <a class=\"squiffy-link link-section\" data-section=\"sneak in past the troops\" role=\"link\" tabindex=\"0\">sneak in past the troops</a> before the Gate closes.</p>\n<p>But you fear the troops on the wall may spot you. You see the glow of Mt. Doom over the mountains overhead and wonder if it might be shorter (and safer) to <a class=\"squiffy-link link-section\" data-section=\"just climb over the mountains\" role=\"link\" tabindex=\"0\">just climb over the mountains</a>.</p>",
		'passages': {
		},
	},
	'sneak in past the troops': {
		'text': "<p>You decide that if you time it just right, you can get in through the Black Gate before they close it, and maybe no one will see you. You sneak close to the Gate, staying close to the rocks, and avoid being seen by the orc army marching past.</p>\n<p>But the closer you get to Mordor, the heavier your Ring gets. The Ring is extremely excited to be here, and you feel faint from its excitement. The world goes hazy.</p>\n<p>{if eaglesComing=0:<a class=\"squiffy-link link-section\" data-section=\"You faint from exhaustion in front of the Black Gate.\" role=\"link\" tabindex=\"0\">You faint from exhaustion in front of the Black Gate.</a>}</p>\n<p>{if eaglesComing=1:Before you faint, <a class=\"squiffy-link link-section\" data-section=\"you see the army suddenly panic.\" role=\"link\" tabindex=\"0\">you see the army suddenly panic.</a>}</p>",
		'passages': {
		},
	},
	'You faint from exhaustion in front of the Black Gate.': {
		'text': "<p>You eventually wake up. The Ring is no longer excited and your head is spinning. Also, the army has passed and the Black Gate is now closed.</p>\n<p>You&#39;ve missed your window to get into Mordor. If only someone had been here to catch you, you might have had a chance. Perhaps going alone wasn&#39;t your best idea.</p>\n<p>At this point, you don&#39;t know when the Gate will open again. Since you don&#39;t know the area or have a guide, your next best idea is to <a class=\"squiffy-link link-section\" data-section=\"just climb over the mountains\" role=\"link\" tabindex=\"0\">just climb over the mountains</a> and see what happens.</p>",
		'passages': {
		},
	},
	'just climb over the mountains': {
		'text': "<p>You find the least steep-looking rock and begin your long ascent over the mountain. You quickly discover this is your worst possible idea ever, and there&#39;s a reason why actual armies would rather take their chances with the Black Gate.</p>\n<p>You spend hours scrambling over rocks, scraping your hands, knees, and feet as you go. You often lose your grip and slide onto pointy rocks. And then sometimes you rest on those pointy rocks because it feels better than climbing. </p>\n<p>{if eaglesComing=1:You often worry the eagles will find you up here, but your elven cloak easily camouflages you into the rock. You are safe from them for now.}</p>\n<p>Fortunately, the mountain is not a lost cause. With enough time, patience, and remaining blood, you&#39;re able to make it to the top after two days.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue184\" role=\"link\" tabindex=\"0\">You roll over and fall down the other side of the mountain.</a></p>",
		'passages': {
		},
	},
	'_continue184': {
		'text': "<p>You&#39;re certain it must look hilarious to any bystanders to see a hobbit tumble down a mountain like a swearing ragdoll and hit every rock on the way down. Your trip down only takes you minutes, although some of your concussions make it feel like years.</p>\n<p>Soon, you hit literal rock bottom and decide to stay there.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue185\" role=\"link\" tabindex=\"0\">A group of strange men suddenly find you.</a></p>",
		'passages': {
		},
	},
	'_continue185': {
		'text': "<p>You are bound in rope and after several hours of walking, you are led to a cave filled with Gondor soldiers.</p>\n<p>You ask why there&#39;s Gondor soldiers in Mordor. They tell you that you didn&#39;t climb into Mordor, but instead rolled down the wrong side of the mountain back into Gondor. And they did indeed laugh as they watched you roll.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are taken before their commander.\" role=\"link\" tabindex=\"0\">You are taken before their commander.</a></p>",
		'passages': {
		},
	},
	'You are taken before their commander.': {
		'text': "<p>Their commander looks very familiar. He announces himself as Faramir, whom you know as Boromir&#39;s brother. You tell him Boromir was your traveling companion. Faramir tells you they found Boromir dead where you left him, killed by orcs.</p>\n<p>He then demands to know, &quot;Why were you sneaking into Mordor? What business does a halfling have there?&quot;</p>\n<p>You don&#39;t time to be a prisoner. You should just <a class=\"squiffy-link link-section\" data-section=\"put the Ring on and escape\" role=\"link\" tabindex=\"0\">put the Ring on and escape</a>. But maybe you&#39;ve been alone too long and need to trust someone. Maybe if you <a class=\"squiffy-link link-section\" data-section=\"tell Faramir about the Ring\" role=\"link\" tabindex=\"0\">tell Faramir about the Ring</a>, he may be able to help you.</p>",
		'passages': {
		},
	},
	'put the Ring on and escape': {
		'text': "<p>Faramir and the others are surprised to see you vanish from sight. He orders his men to find you, but you easily retrace your steps through the cave and escape back out the front entrance.</p>\n<p>{if eaglesComing=0:You take off the Ring and decide to take a southern route around the mountains and try to <a class=\"squiffy-link link-section\" data-section=\"find another way into Mordor\" role=\"link\" tabindex=\"0\">find another way into Mordor</a>.}</p>\n<p>{if eaglesComing=1:You decide to take a southern route around the mountains, but eventually make the mistake of taking the Ring off.}</p>\n<p>{if eaglesComing=1:There&#39;s a loud shriek in the skies above. You don&#39;t even see the eagles descend upon you until you&#39;re within their talons. <a class=\"squiffy-link link-section\" data-section=\"You are taken into the skies and away from Mordor.\" role=\"link\" tabindex=\"0\">You are taken into the skies and away from Mordor.</a>}</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'find another way into Mordor': {
		'text': "<p>After several days of walking, you happen upon a large, wicked fortress built into the mountain. You have found MINAS MORGUL, another gateway into the land. </p>\n<p>Unfortunately, this entrance looks far more problematic than the Black Gate. There&#39;s far more soldiers moving in and out of its gates, and you can clearly see the BLACK RIDERS standing guard at its base, while the WITCH KING flies overhead.</p>\n<p>You&#39;re certain you can&#39;t enter the fortress, but maybe you can <a class=\"squiffy-link link-section\" data-section=\"find a secret passage around it\" role=\"link\" tabindex=\"0\">find a secret passage around it</a>. Or maybe you should just <a class=\"squiffy-link link-section\" data-section=\"go back and take your chances with Faramir's people\" role=\"link\" tabindex=\"0\">go back and take your chances with Faramir&#39;s people</a>.</p>",
		'passages': {
		},
	},
	'go back and take your chances with Faramir\'s people': {
		'text': "<p>Days later, you come crawling back to Faramir. They&#39;re surprised to see you return. You <a class=\"squiffy-link link-section\" data-section=\"tell Faramir about the Ring\" role=\"link\" tabindex=\"0\">tell Faramir about the Ring</a> and beg for his help. Fortunately, he bears no grudge towards you in this grovely state and is willing to listen.</p>",
		'passages': {
		},
	},
	'tell Faramir about the Ring': {
		'text': "<p>{if merryDead=1:{if pippinDead=1:{if gandalfDead=1:{if bilboDead=1:{if samDrowned=1:{@friendsDead=5}}}}}} </p>\n<p>{if merryDead=1:{if pippinDead=1:{if gandalfDead=1:{if bilboDead=0:{if samDrowned=1:{@friendsDead=4}}}}}} </p>\n<p>You tell him your whole mission. You tell him you, Boromir, and a group of other companions were journeying into Mordor to destroy that thing. But Boromir&#39;s betrayal forced you to take matters into your own hands. </p>\n<p>Faramir listens intently to the details of your quest and decides he will not try to take the Ring for himself. He&#39;s not petty like his brother.</p>\n<p>{if samDrowned=1:However, when you mention Sam, Faramir is sad to inform you that they found his body at the bottom of a waterfall. Your heart sinks at this news.{if friendDead&gt;2: It&#39;s yet another tragic loss on your journey.}{if friendsDead=4: It seems everyone who traveled with you from the Shire is dead. Fortunately, your uncle Bilbo is still alive, so a piece of home still rests in your heart. You are not shattered yet.}}</p>\n<p>{if friendsDead=5:<a class=\"squiffy-link link-section\" data-section=\"The Ring suddenly feels ice cold.\" role=\"link\" tabindex=\"0\">The Ring suddenly feels ice cold.</a>}</p>\n<p>{if friendsDead&lt;5:<a class=\"squiffy-link link-section\" data-section=\"Faramir confers with his men.\" role=\"link\" tabindex=\"0\">Faramir confers with his men.</a>}</p>",
		'attributes': ["friendsDead = 0"],
		'passages': {
		},
	},
	'find a secret passage around it': {
		'text': "<p>You search around the mountain base for a secret tunnel or stairway around the fortress. If such a thing exists, it would be easier to find with a guide.</p>\n<p>Unfortunately, you&#39;re not very good at being stealthy, especially when the Black Riders can sense your Ring. Late into the day, they find and corner you. You try to scramble up a mountain to escape, but lose your footing and tumble down the rocks.</p>\n<p>The Witch King approaches. &quot;Take him to Minas Morgul. We&#39;ll extract the Ring there.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue186\" role=\"link\" tabindex=\"0\">The orcs take you into their citadel.</a></p>",
		'passages': {
		},
	},
	'_continue186': {
		'text': "<p>You are dragged through the dark halls of Minas Morgul. The faceless Black Riders escort you down to the deepest dungeons.</p>\n<p>You are thrown to the floor of a torture chamber. The WITCH KING enters the room and orders the orcs to leave. It&#39;s now just you and your old friends, the Black Riders. This is DEFINITELY not better than dealing with Faramir&#39;s men.</p>\n<p>One of the Black Riders slides the tip of their blade under your vest and lifts the Ring up on its chain. They all lean in greedily.</p>\n<p>The Witch King wards them away and speaks. &quot;The Ring will be returned to the Dark Lord. See to it this halfling suffers for our troubles.&quot;</p>\n<p>You want to <a class=\"squiffy-link link-passage\" data-passage=\"spit in the Witch King's face\" role=\"link\" tabindex=\"0\">spit in the Witch King&#39;s face</a>, but you hear an old, ghostly voice speak, &quot;Now&#39;s the time, Frodo! You must <a class=\"squiffy-link link-section\" data-section=\"put the Ring on before it's too late!\" role=\"link\" tabindex=\"0\">put the Ring on before it&#39;s too late!</a>&quot;</p>",
		'passages': {
			'spit in the Witch King\'s face': {
				'text': "<p>You miss and spit on his foot. The Witch King does not take the insult lightly and firmly grips his mace.</p>\n<p>&quot;On second thought,&quot; he says to his Riders, &quot;Allow me to do the honours.&quot;</p>",
			},
		},
	},
	'put the Ring on before it\'s too late!': {
		'text': "<p>If there was ever a time, this is it, you suppose. You quickly slide the Ring onto your finger and become invisible. Unfortunately, this does not hide you from the Riders. In fact, now you see their horrible, decayed faces clear as day. If anything, you are now more visible to them than before. They advance on you.</p>\n<p>This it it. There&#39;s nowhere to hide.</p>\n<p>Then <a class=\"squiffy-link link-section\" data-section=\"a flash of light explodes through the room\" role=\"link\" tabindex=\"0\">a flash of light explodes through the room</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'a flash of light explodes through the room': {
		'text': "<p>The Black Riders draw their blades and attack an unknown entity that has entered the room. The entity disappears and reappears around the room, parrying their strikes and knocking them away with blinding speed.</p>\n<p>The Witch King tries to defend himself as the entity knocks him backwards into a cauldron of molten gold. The Witch King struggles, screaming &quot;No man can kill me!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue187\" role=\"link\" tabindex=\"0\">A man suddenly appears before you.</a></p>",
		'passages': {
		},
	},
	'_continue187': {
		'text': "<p>You are shocked to discover he is a ghost, barely visible in this light. He appears to be a ranger like Aragorn, but he looks more battle-hardened and twitchy.</p>\n<p>&quot;Welcome to Minas Morgul,&quot; he says. You recognize his voice from your time in the Dead Marshes. &quot;I can <a class=\"squiffy-link link-section\" data-section=\"explain everything\" role=\"link\" tabindex=\"0\">explain everything</a> and <a class=\"squiffy-link link-section\" data-section=\"get you out of here\" role=\"link\" tabindex=\"0\">get you out of here</a>, but first I need to possess your body.&quot;</p>",
		'passages': {
		},
	},
	'explain everything': {
		'text': "<p>You ask him if he&#39;s a ghost, and he answers by possessing you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You suddenly turn into a rugged man with a sword.\" role=\"link\" tabindex=\"0\">You suddenly turn into a rugged man with a sword.</a></p>",
		'passages': {
		},
	},
	'get you out of here': {
		'text': "<p>You ask him how you&#39;ll escape, and he answers by possessing you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You suddenly turn into a rugged man with a sword.\" role=\"link\" tabindex=\"0\">You suddenly turn into a rugged man with a sword.</a></p>",
		'passages': {
		},
	},
	'You suddenly turn into a rugged man with a sword.': {
		'text': "<p>Orcs pour into the torture chamber to stop you. The Black Riders stand from the floor. The Witch King climbs out of the boiling cauldron. They all run towards you, weapons ready.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue188\" role=\"link\" tabindex=\"0\">You raise your blade and go combo-happy on their Morgul butts.</a></p>",
		'passages': {
		},
	},
	'_continue188': {
		'text': "<p>You quickly realize that while you feel like a six-foot tall Gondor man, you&#39;re still literally a three-foot hobbit. You have to strike at your enemies from a much lower angle, and re-evaluate the brutality of your finishers.</p>\n<p>Fortunately, you still have your amazing ghost powers and can easily <a class=\"squiffy-link link-passage\" data-passage=\"shadow-strike\" role=\"link\" tabindex=\"0\">shadow-strike</a> and <a class=\"squiffy-link link-passage\" data-passage=\"wraith burn\" role=\"link\" tabindex=\"0\">wraith burn</a> your foes. But you really should <a class=\"squiffy-link link-section\" data-section=\"get out of this torture chamber\" role=\"link\" tabindex=\"0\">get out of this torture chamber</a> at your nearest convenience.</p>",
		'passages': {
			'shadow-strike': {
				'text': "<p>You teleport back and forth across the room, hacking away at the Black Riders. You decapitate a couple for good measure.</p>",
			},
			'wraith burn': {
				'text': "<p>You release a circle of fire to engulf the room. Two of the Black Riders get vaporized in its wake.</p>",
			},
		},
	},
	'get out of this torture chamber': {
		'text': "<p>The Witch King lunges at you, but you vanish from its sight and head upstairs. The Witch King shrieks vengeance at you, declaring you its nemesis.</p>\n<p>You run through the corridors of Minas Morgul, climbing walls, parkouring over ruins, and camping in rafters firing elf-shots at orcs.</p>\n<p>You soon find a vicious caragor in a cage and dominate it with your will. This beast will be your ride out of this accursed city.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue189\" role=\"link\" tabindex=\"0\">Before you leave, you take a moment to level up.</a></p>",
		'passages': {
		},
	},
	'_continue189': {
		'text': "<p>You can only wonder what Frodo thinks of your personal micro-management as you wonder which abilities to spend your power points on.</p>\n<p>It&#39;s a toss-up between two new halfling-themed skills: <a class=\"squiffy-link link-section\" data-section=\"Hobbit Rush\" role=\"link\" tabindex=\"0\">Hobbit Rush</a> or <a class=\"squiffy-link link-section\" data-section=\"Shire Fire\" role=\"link\" tabindex=\"0\">Shire Fire</a>.</p>",
		'passages': {
		},
	},
	'Hobbit Rush': {
		'text': "<p>You pick a fun new melee attack for later.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You hop on your caragor and ride out of Minas Morgul.\" role=\"link\" tabindex=\"0\">You hop on your caragor and ride out of Minas Morgul.</a></p>",
		'attributes': ["talionSkill = 1"],
		'passages': {
		},
	},
	'Shire Fire': {
		'text': "<p>You pick an exciting new magic attack for later.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You hop on your caragor and ride out of Minas Morgul.\" role=\"link\" tabindex=\"0\">You hop on your caragor and ride out of Minas Morgul.</a></p>",
		'attributes': ["talionSkill = 2"],
		'passages': {
		},
	},
	'You hop on your caragor and ride out of Minas Morgul.': {
		'text': "<p>The rest of the Black Riders are hot on your heels as you ride into Mordor. You race through an enemy camp, knocking over torches and barrels to block their path.</p>\n<p>At some point, you run into a barricade of unsuspecting orc soldiers, but you successfully Tokyo Drift through their numbers while the Black Riders collide with their own men.</p>\n<p>You leave the 100-orc pile-up behind and ride on towards Mt. Doom with the full army in tow.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You eventually lose the army and find a cave to lie low in\" role=\"link\" tabindex=\"0\">You eventually lose the army and find a cave to lie low in</a></p>",
		'passages': {
		},
	},
	'You eventually lose the army and find a cave to lie low in': {
		'text': "<p>The intruding spirit leaves your body. You are now Frodo again.</p>\n<p>You stare wide-eyed with horror at the crazy spirit who just saved you and demand explanations.</p>\n<p>&quot;In Sauron&#39;s time, he was a powerful necromancer,&quot; the ghost explains. &quot;This land is poisoned with his death magic, and many souls are ensnared within its borders. Mine included.&quot;</p>\n<p>As he says this, you notice more ghosts of soldier men appear around the cave. They approach your position with curiosity. Your Ring starts to feel tight.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue190\" role=\"link\" tabindex=\"0\">You eagerly remove the Ring and try to put it back on its chain.</a></p>",
		'passages': {
		},
	},
	'_continue190': {
		'text': "<p>&quot;Hold onto the Ring,&quot; the ghost insists. &quot;Sauron&#39;s power allows you to pierce the veil and walk among souls. It is how I speak to you.&quot;</p>\n<p>You ask his name.</p>\n<p>&quot;I am Talion, a lost sentinel of Gondor who was murdered and bound to this land as a wraith. First, I became a Shadow of Mordor. Then a Shadow of War. Now a Shadow of Doom. I&#39;ve fought since death to prevent Mordor from forging new Rings, and now that you&#39;re here, we can finally end my curse.&quot;</p>\n<p>&quot;Sauron&#39;s army will try to stop us from reaching Mt. Doom. If you had the <a class=\"squiffy-link link-passage\" data-passage=\"Sword of Narsil\" role=\"link\" tabindex=\"0\">Sword of Narsil</a>, perhaps we could persuade some of the restless spirits to help us fight, but otherwise we&#39;ll have to <a class=\"squiffy-link link-section\" data-section=\"advance on Mt. Doom\" role=\"link\" tabindex=\"0\">advance on Mt. Doom</a> ourselves.&quot;</p>",
		'passages': {
			'Sword of Narsil': {
				'text': "<p>You ask about the Narsil sword.</p>\n<p>&quot;It&#39;s the Gondor blade that first cut the Ring from Sauron&#39;s hand. It was shattered and its pieces lost... but if it were reforged, these souls would follow it anywhere. Many were deserters on the battlefield who won&#39;t rest until they&#39;ve carried out their vow to Gondor.&quot;</p>\n<p>{if hasSwordSting=1:You wonder <a class=\"squiffy-link link-passage\" data-passage=\"if he means Sting\" role=\"link\" tabindex=\"0\">if he means Sting</a>, your uncle&#39;s sword. }{if hasButterknife=1:{if hasSwordSting=1:Otherwise, you}{if hasSwordSting=0:You} wonder <a class=\"squiffy-link link-section\" data-section=\"if your butterknife would qualify\" role=\"link\" tabindex=\"0\">if your butterknife would qualify</a>.}</p>",
			},
			'if he means Sting': {
				'text': "<p>You show him your glowing sword. He shakes his head.</p>\n<p>&quot;No, sorry. That&#39;s just a regular magic sword. Nothing to do with Narsil.&quot;</p>",
			},
		},
	},
	'if your butterknife would qualify': {
		'text': "<p>His jaw drops as you hold your butterknife aloft. All the ghosts suddenly drop to their knees in holy reverence.</p>\n<p>&quot;It is the Sword of Narsil!&quot; Talion exclaims. &quot;It&#39;s in an unlikely form, but this is clearly reforged from the same blade! Where did you find it?&quot;</p>\n<p>You tell him a travelling salesman accidentally dropped it off his wagon years ago and your uncle helped himself. You use it to spread jam on toast on days where you don&#39;t have tea.</p>\n<p>&quot;A shard of it must have been scavenged and reforged into common household cutlery. It may not be the complete sword, but it is reforged nonetheless! Dear Frodo, the spirits of Mordor will follow you ANYWHERE. Please, hold them to their vow and let us <a class=\"squiffy-link link-section\" data-section=\"take Mt. Doom by force!\" role=\"link\" tabindex=\"0\">take Mt. Doom by force!</a>&quot;</p>",
		'attributes': ["butterknifeKing = 1"],
		'passages': {
		},
	},
	'advance on Mt. Doom': {
		'text': "<p>You decide to abandon your caragor here and go on a full-on stealth mission towards Mt. Doom. It&#39;s a long, grueling mission as you sneak from camp-to-camp, trying to detect evasion. It&#39;s notoriously difficult since the army is searching for you non-stop.</p>\n<p>You get caught a few times and find yourself running around scared, hiding in haystacks and waiting for your notoriety level to drop. It&#39;s very embarrassing, really. You wish you managed to find the Sword of Narsil somewhere on your journey; an army of ghosts would come in very handy right now.</p>\n<p>Soon, you arrive at the mountain.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You head up the side of Mt. Doom.\" role=\"link\" tabindex=\"0\">You head up the side of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'take Mt. Doom by force!': {
		'text': "<p>You are so down for this. Holding up your epic butterknife for all to see, you hop on your caragor. Talion repossesses your body and leads the charge out of the cave.</p>\n<p>All the ghosts of Mordor rise from their restless sleep. Clad in ghostly armour and carrying ghostly weapons, they race out on the fields and begin attacking the orc camps. The orcs are powerless against them.</p>\n<p>It&#39;s not just men of Gondor either. All who fell in the first War of the Ring rise up to your aid. The spirits of men, elves, dwarves -- even orcs and goblins eager for a good fight. Like a spectral tidal wave, they swarm the landscape and tear down Sauron&#39;s forces. </p>\n<p>The Flaming Eye of Sauron watches from its tower as your ghost army lays waste to his wastes. </p>\n<p>Once the path to the mountain is clear, you relief the army of duty and carry on unhindered. You release your caragor back into the wild.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You head up the side of Mt. Doom.\" role=\"link\" tabindex=\"0\">You head up the side of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You head up the side of Mt. Doom.': {
		'text': "<p>As Talion, you find a cave into the heart of the mountain and approach the edge of a great lava pit. It&#39;s been ages since you were last here and its only right that your curse bring you back to this place.</p>\n<p>Having successfully delivered Frodo to this place, you release him and become a wraith once more.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue191\" role=\"link\" tabindex=\"0\">You are now Frodo once again.</a></p>",
		'passages': {
		},
	},
	'_continue191': {
		'text': "<p>&quot;<a class=\"squiffy-link link-section\" data-section=\"Cast the Ring into the fires\" role=\"link\" tabindex=\"0\">Cast the Ring into the fires</a>,&quot; Talion tells you. &quot;Let its evil poison this land no further.&quot;</p>",
		'passages': {
		},
	},
	'Cast the Ring into the fires': {
		'text': "<p>This is it! Your shining moment!</p>\n<p>You hold the Ring over the lava while Talion stands guard. Its shine beckons you to <a class=\"squiffy-link link-section\" data-section=\"not throw it in\" role=\"link\" tabindex=\"0\">not throw it in</a>. But with Talion watching, maybe you should just <a class=\"squiffy-link link-section\" data-section=\"drop the Ring into the fire\" role=\"link\" tabindex=\"0\">drop the Ring into the fire</a>.</p>",
		'passages': {
		},
	},
	'not throw it in': {
		'text': "<p>And why not keep it? You carried this far. You&#39;re worthy enough to carry it, right?</p>\n<p>&quot;FRODO,&quot; Talion scolds you. &quot;I&#39;m warning you: don&#39;t do this. Just <a class=\"squiffy-link link-section\" data-section=\"drop the Ring into the fire\" role=\"link\" tabindex=\"0\">drop the Ring into the fire</a>.&quot;</p>\n<p>You wonder what he would do if <a class=\"squiffy-link link-section\" data-section=\"you put it on instead\" role=\"link\" tabindex=\"0\">you put it on instead</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'you put it on instead': {
		'text': "<p>Being a stinker, you slide the Ring onto your finger.</p>\n<p>In a blink, Talion surges forward and grabs your hand, pulling the Ring off your fingers and slapping your hand. &quot;NO, FRODO! BAD FRODO! RING IN THE VOLCANO, NOW!&quot;</p>\n<p>As he struggles with you, <a class=\"squiffy-link link-section\" data-section=\"you both hear a shriek from above\" role=\"link\" tabindex=\"0\">you both hear a shriek from above</a>. </p>",
		'attributes': ["precious+=1","precious+=1"],
		'passages': {
		},
	},
	'drop the Ring into the fire': {
		'text': "<p>You try to drop the Ring, but the Ring is resilient. Your fingers suddenly seize up and clutch it even tighter, as if the Ring itself were in control of them. You ask Talion for an assist.</p>\n<p>&quot;The Ring does that sometimes,&quot; he says as he comes over to smack it out of your hand.</p>\n<p>Suddenly, <a class=\"squiffy-link link-section\" data-section=\"you both hear a shriek from above\" role=\"link\" tabindex=\"0\">you both hear a shriek from above</a>.</p>",
		'passages': {
		},
	},
	'you both hear a shriek from above': {
		'text': "<p>The WITCH KING descends into Mt. Doom on his steed and dismounts. You&#39;re trapped between him and the fire.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Talion jumps into your body and confronts the Witch King.\" role=\"link\" tabindex=\"0\">Talion jumps into your body and confronts the Witch King.</a></p>",
		'passages': {
		},
	},
	'Talion jumps into your body and confronts the Witch King.': {
		'text': "<p>You are now Talion once more. </p>\n<p>&quot;Fools, no MAN can kill me!&quot; The Witch King repeats for the hundredth time that day.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue192\" role=\"link\" tabindex=\"0\">You battle the Witch King atop the cliffs.</a></p>",
		'passages': {
		},
	},
	'_continue192': {
		'text': "<p>Your speed and skill are no match for his overwhelming strength. You strikes at his neck and joints, but can&#39;t knock him down or injure him in any way. He laughs at your feeble attempts and shatters your sword with his mace. He throws you towards the cliff&#39;s edge, but you scramble to your feet.</p>\n<p>&quot;Prepare to die,&quot; he says. &quot;For no MAN can kill me.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue193\" role=\"link\" tabindex=\"0\">You unleash your special move.</a></p>",
		'passages': {
		},
	},
	'_continue193': {
		'text': "<p>{if talionSkill=1:Your wraith powers activate and your body generates a dozen shadow copies of yourself that surround the Witch King. He is surprised as he is rushed by several hobbits at once. He swings and decimates his foes, but fails to strikes the real you. You get behind him, rush in, and deliver a 100-hit combo, staggering the Witch King towards the cliff.}\n{if talionSkill=2:The power of a thousand hearths takes over your body. Your hair glows yellow as you knock the Witch King back with a wave of flame and shout &quot;SHIRE FIRE!&quot; Then you blind him with a bright blast, get behind him, and devastate him with one fire blast from your fists after another. He staggers towards the cliff.}</p>\n<p>&quot;I am no MAN,&quot; you say, &quot;I am a GHOST RIDING A HOBBIT!&quot;</p>\n<p>{if talionSkill=1:You roundhouse-kick him off the cliff in slow-motion.}\n{if talionSkill=2:You gather up the energy of a thousand hearths in your hands and shout &quot;SHIRE FIRE TIMES TWO!!!&quot; as you use a powerful stream of energy to blast him off the cliff.}</p>\n<p>&quot;SEMMAAAANNNNTIIIIICCCCSSSS!&quot; the Witch King shouts as he plunges into the lava.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue194\" role=\"link\" tabindex=\"0\">You and Talion separate.</a></p>",
		'passages': {
		},
	},
	'_continue194': {
		'text': "<p>&quot;Now throw it in,&quot; Talion says. Without hesitation, you throw the Ring in.</p>\n<p>It slowly melts into the lava. You see Talion begin to fade.</p>\n<p>&quot;The Ring no longer binds me to this plane,&quot; he says. &quot;Now you have freed me. Thank you, Frodo. You&#39;ve come a long way for such a little hobbit. I pray you will one day learn to trust your friends again, and that your Fellowship will have you back. Good luck.</p>\n<p>He disappears and the volcano begins to erupt.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue195\" role=\"link\" tabindex=\"0\">You escape Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue195': {
		'text': "<p>In the coming days, you are rescued from Mordor by an eagle, riden by none other than Gandalf.{if gandalfDead=1: You are relieved to see him alive, and sporting new white robes.} He takes you to Minas Tirith.</p>\n<p>While you were in Mordor, the Fellowship battled Saruman&#39;s army in Rohan.{if merryPippinInRohan=1: Merry and Pippin led an army of trees and won the day for everyone.} Any further battles were interrupted by your prompt destruction of the Ring, so everyone&#39;s very grateful, even if they don&#39;t believe your ghost stories.</p>\n<p>You meet up once more with the Fellowship. Aragorn and the other are delighted to see you&#39;re alive. {if boromirDead=0:Boromir is also here, alive and well, albeit with a few arrow scars. He apologizes for trying to take the Ring and insists his father, King Denethor, gives the Fellowship a warm welcome in the city.}{if boromirDead=1:However, King Denethor isn&#39;t warm about your arrival since his son Boromir was killed on your journey, so you don&#39;t get any comfy beds or good food.} And then Faramir and his men show up and reveal you as a spy who escaped their capture. This causes some disturbance, with people referring to you as an enemy of Gondor, and Gandalf decides <a class=\"squiffy-link link-section\" data-section=\"it's better if you all just left town\" role=\"link\" tabindex=\"0\">it&#39;s better if you all just left town</a>.</p>\n<p>{if butterknifeKing=1:<a class=\"squiffy-link link-section\" data-section=\"But your butterknife might say otherwise.\" role=\"link\" tabindex=\"0\">But your butterknife might say otherwise.</a>}</p>",
		'passages': {
		},
	},
	'But your butterknife might say otherwise.': {
		'text': "<p>You show everyone your butterknife, the reforged Sword of Narsil, and declare that it gives you true claim to the throne of Gondor. At first, everyone laughs, but after inspecting your butterknife, they&#39;re inclined to agree. It&#39;s the real deal.</p>\n<p>King Denethor is removed from power and you are crowned the rightful king of Gondor.</p>\n<p>Aragorn cheers for you, but feels ripped off somehow. Gandalf is super-confused.</p>\n<p>You let the Fellowship stay and remain as part of your special council. They&#39;re happy to oblige. {if fellowship&lt;2:But you put Arwen and Glorfy in charge of the treasury and they spend it all on candy, bankrupting Minas Tirith within the week.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue196\" role=\"link\" tabindex=\"0\">And that&#39;s how your journey ends.</a></p>",
		'passages': {
		},
	},
	'_continue196': {
		'text': "<p>You Frodo, have gone from your modest hobbit home to the throne of Gondor. And while some aspects of your story seem more exaggerated than others, no one can really prove otherwise since you made your journey alone. </p>\n<p>For that matter, you also lassoed a tornado and rode a fridge out of a nuclear blast. So go ahead, people of Gondor. Prove it didn&#39;t happen. Prove this butterknife didn&#39;t command an army of ghosts. No one can, so shut up. </p>\n<p>You sit on your throne and enjoy {if jam=0:a cup of tea}{if jam=1:some toast}.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'it\'s better if you all just left town': {
		'text': "<p>You don&#39;t like being an enemy of Gondor, so Gandalf escorts you{if merryPippinInRohan=1:, Merry, and Pippin} back home. Everyone else goes their separate ways, feeling like they missed out on a much bigger adventure. </p>\n<p>And that&#39;s how your journey ends. You go home and return to doing hobbit stuff. Eventually, the elves leave for the Grey Havens with Gandalf, and Gondor moves into Mordor and helps themselves to some of Rohan as well. Last time you hear, they were at war with a bunch of trees, but that&#39;s of no concern to you.</p>\n<p>Some nights, you sit and wonder if Talion&#39;s in a better place. But he literally died in a flaming inferno, so you don&#39;t have high hopes for him.</p>\n<p>Middle-Earth finally saved, you sit on your couch and finally enjoy {if jam=0:a cup of tea}{if jam=1:some toast}.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'Faramir confers with his men.': {
		'text': "<p>They agree you must finish your quest, but can&#39;t risk sending an escort into Mordor. Faramir has another plan.</p>\n<p>&quot;There&#39;s an old mine cart shaft in this cave,&quot; he says. &quot;The orcs installed it centuries ago. You could take it straight to Mt. Doom.&quot;</p>\n<p>His men lead you to a mining tunnel where you find a mine cart atop a long system of rails. It looks like a ride waiting to happen. Faramir shows you a lever on the cart.</p>\n<p>&quot;If you see a divergence in the rails, you can use this to shift LEFT and RIGHT,&quot; he explains. &quot;Just remember that when you get to the LAVA ROOM, go RIGHT. I repeat: GO RIGHT.&quot;</p>\n<p>It&#39;s time to <a class=\"squiffy-link link-section\" data-section=\"ride the rails\" role=\"link\" tabindex=\"0\">ride the rails</a>, but this seems dangerous. Maybe you&#39;d rather <a class=\"squiffy-link link-passage\" data-passage=\"just walk there\" role=\"link\" tabindex=\"0\">just walk there</a>?</p>",
		'passages': {
			'just walk there': {
				'text': "<p>&quot;Nope!&quot; Faramir picks you up and puts you in the mine cart. You&#39;re doing this.</p>",
			},
		},
	},
	'ride the rails': {
		'text': "<p>You push off down the tunnel, your mine cart wildly careening through the ancient caves. The ride is rickety, but delightful. This is most fun you&#39;ve had since abandoning your friends.</p>\n<p>Miles down the path, you pass a group of orcs in the cave. They see you and hop into their own mine cart to go after you. The chase is on!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue197\" role=\"link\" tabindex=\"0\">They ride up behind your mine cart.</a></p>",
		'passages': {
		},
	},
	'_continue197': {
		'text': "<p>{if hasSwordSting=1:You duel the orcs from your cart with your uncle&#39;s sword.}{if hasSwordSting=0:You repeatedly duck as they swing their blades at your head. Their swords spark against the cart&#39;s metal frame.} They ram you from behind and you fall against the lever. Their cart is now hooked onto yours.</p>\n<p>Up ahead, you see two paths as the rails split. <a class=\"squiffy-link link-section\" data-section=\"To the LEFT\" role=\"link\" tabindex=\"0\">To the LEFT</a> is a tunnel full of inviting, colourful flowers. <a class=\"squiffy-link link-section\" data-section=\"To the RIGHT\" role=\"link\" tabindex=\"0\">To the RIGHT</a> is a thorny tunnel full of long spikes jutting from the wall.</p>",
		'passages': {
		},
	},
	'To the LEFT': {
		'text': "<p>You veer left towards the lovely tunnel. Unfortunately, where there&#39;s flowers, there&#39;s bees. You stir up a swarm that instantly attack your cart. The orcs laugh at your misfortune.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ride into a room full of lava.\" role=\"link\" tabindex=\"0\">You ride into a room full of lava.</a></p>",
		'passages': {
		},
	},
	'To the RIGHT': {
		'text': "<p>You veer right towards the spikey tunnel. This catches the orcs off-guard as they pursue you. While you duck under the spikes, they get impaled and their cart detaches from yours.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ride into a room full of lava.\" role=\"link\" tabindex=\"0\">You ride into a room full of lava.</a></p>",
		'attributes': ["defeatedMineCartOrcs = 1"],
		'passages': {
		},
	},
	'You ride into a room full of lava.': {
		'text': "<p>Your cart passes over a flaming river. {if defeatedMineCartOrcs=0:The orcs look wary about pursuing you into here.} Up ahead, you see another rail split, prompting you to <a class=\"squiffy-link link-section\" data-section=\"turn left\" role=\"link\" tabindex=\"0\">turn left</a> or <a class=\"squiffy-link link-section\" data-section=\"turn right\" role=\"link\" tabindex=\"0\">turn right</a>.</p>",
		'passages': {
		},
	},
	'turn left': {
		'text': "<p>You clearly remember Faramir&#39;s instructions, but you turn left anyway.{if defeatedMineCartOrcs=0: The orcs look terrified as your cart drags theirs into the left tunnel.} You enter a massive volcanic chamber filled with pools of lava and fiery waterfalls.</p>\n<p>There&#39;s a giant spider in here. Like, REALLY big. Not &quot;size of a troll&quot; big, but more &quot;size of this whole room&quot; big.{if defeatedMineCartOrcs=0: The orcs scream the name &quot;Ungoliant!&quot; as you ride towards it.} The spider lunges forward and tears through the rails behind you with a leg the size of a thick tree.{if defeatedMineCartOrcs=0: The orcs are crushed.} You ride up the trashed rails and loop around the room with the spider in pursuit.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue198\" role=\"link\" tabindex=\"0\">The spider loses interest and falls back.</a></p>",
		'passages': {
		},
	},
	'_continue198': {
		'text': "<p>Getting ahead of the monster spider, you loop back to the split and decide to wisely <a class=\"squiffy-link link-section\" data-section=\"turn right\" role=\"link\" tabindex=\"0\">turn right</a> this time now that your curiosity is sated.</p>",
		'attributes': ["defeatedMineCartOrcs = 1"],
		'passages': {
		},
	},
	'turn right': {
		'text': "<p>You disappear down a dark tunnel, go down a steep incline, and rocket off a ramp towards the ceiling. You fly out a hole in the ground and soar high into the sky over Mordor. Down below, you see orc encampments, and a giant tower with a flaming eye. You see you&#39;re now falling towards Mt. Doom with no safety net.</p>\n<p>{if eaglesComing=1:Just then, an eagle-shaped safety net flies into your path. The scarred eagle whose been hunting you accidentally gets in your way. Your mine cart slams into it, taking it by surprise, and you both fall towards the mountain.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue199\" role=\"link\" tabindex=\"0\">You have a crash landing.</a></p>",
		'passages': {
		},
	},
	'_continue199': {
		'text': "<p>{if eaglesComing=1:The scarred eagle cushions your landing nicely. You bounce off its corpse and roll smoothly into a cave, entering the heart of Mt. Doom.}</p>\n<p>{if eaglesComing=0:You land with an unelegant crash and tumble out of the mine cart into a cave, breaking several bones as you roll. You come to stop in a passageway leading into the heart of Mt. Doom.}</p>\n<p>{if defeatedMineCartOrcs=0:You then hear orcs screaming as their mine cart lands past yours. They keep rolling forward, hitting you out of the way as they go, and disappear into the cave ahead where they fall into a river of lava. You sustain more broken bones in the process. Fortunately, you still have enough unbroken bones to <a class=\"squiffy-link link-section\" data-section=\"enter the mountain and finish this\" role=\"link\" tabindex=\"0\">enter the mountain and finish this</a>.}</p>\n<p>{if defeatedMineCartOrcs=1:The mine cart chase behind you, you decide to <a class=\"squiffy-link link-section\" data-section=\"enter the mountain and finish this\" role=\"link\" tabindex=\"0\">enter the mountain and finish this</a>.}</p>",
		'passages': {
		},
	},
	'enter the mountain and finish this': {
		'text': "<p>You {if defeatedMineCartOrcs=1:walk to}{if defeatedMineCartOrcs=0:limp to}  the edge of a precipice overlooking the fires of Mt. Doom.{if defeatedMineCartOrcs=0: Down below, you still hear the orcs screaming as they fry in the lava.}</p>\n<p>This is your moment, Frodo. It&#39;s time to <a class=\"squiffy-link link-section\" data-section=\"throw the Ring in and save Middle-Earth\" role=\"link\" tabindex=\"0\">throw the Ring in and save Middle-Earth</a>.</p>\n<p>You came this far without a Fellowship. Without friends. Your Uncle Bilbo might have once walked into a dragon&#39;s lair, but here you stand in the heart of Doom itself. </p>\n<p>As you look upon the Ring, you feel the urge to <a class=\"squiffy-link link-section\" data-section=\"tell it goodbye\" role=\"link\" tabindex=\"0\">tell it goodbye</a>. You did go through quite a lot together.</p>",
		'passages': {
		},
	},
	'tell it goodbye': {
		'text': "<p>You whisper sweet nothings to the Ring. It whispers back, &quot;I&#39;ll miss you.&quot;</p>\n<p>Suddenly, you&#39;re not sure if you&#39;re ready to <a class=\"squiffy-link link-section\" data-section=\"throw the Ring in and save Middle-Earth\" role=\"link\" tabindex=\"0\">throw the Ring in and save Middle-Earth</a>. Especially when it hasn&#39;t spent enough time on your finger. Maybe you should <a class=\"squiffy-link link-section\" data-section=\"pop it on for old times' sake\" role=\"link\" tabindex=\"0\">pop it on for old times&#39; sake</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'pop it on for old times\' sake': {
		'text': "<p>Yes, the Ring is yours after all. And no one is here to stop you from keeping it. As you slide it on, you wonder what kind of shenanigans you can get up to while invisible. You can&#39;t believe you haven&#39;t pranked anyone with this thing yet. You could raid Farmer Maggot&#39;s field from dawn to dusk with the help of your Precious.</p>\n<p>To <a class=\"squiffy-link link-section\" data-section=\"throw the Ring in and save Middle-Earth\" role=\"link\" tabindex=\"0\">throw the Ring in and save Middle-Earth</a> might be a waste of perfectly good jewelry.</p>\n<p>You haven&#39;t even taken time <a class=\"squiffy-link link-passage\" data-passage=\"lick it\" role=\"link\" tabindex=\"0\">lick it</a>, or <a class=\"squiffy-link link-passage\" data-passage=\"smell it\" role=\"link\" tabindex=\"0\">smell it</a>, or <a class=\"squiffy-link link-passage\" data-passage=\"sing it a little song\" role=\"link\" tabindex=\"0\">sing it a little song</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
			'lick it': {
				'text': "<p>You taste it a little. Mmmm... it&#39;s a little dirty, but that was worth it.</p>",
				'attributes': ["precious+=1"],
			},
			'smell it': {
				'text': "<p>It smells like cold metal, with hint of hobbit sweat.</p>",
				'attributes': ["precious+=1"],
			},
			'sing it a little song': {
				'text': "<p>The Ring loves your singing voice. It hums melodically in response.</p>",
				'attributes': ["precious+=1"],
			},
		},
	},
	'throw the Ring in and save Middle-Earth': {
		'text': "<p>Okay, okay, enough back-pedaling. You have a job to do, after all.</p>\n<p>You reel back and prepare to toss it in.</p>\n<p>{if precious&lt;10:<a class=\"squiffy-link link-section\" data-section=\"You take a deep breath and launch it.\" role=\"link\" tabindex=\"0\">You take a deep breath and launch it.</a>}\n{if precious&gt;9:<a class=\"squiffy-link link-section\" data-section=\"And then decide not to.\" role=\"link\" tabindex=\"0\">And then decide not to.</a>}</p>",
		'passages': {
		},
	},
	'You take a deep breath and launch it.': {
		'text': "<p>It feels bittersweet releasing the Ring into Doom&#39;s fire, but you&#39;re glad you were able to resist it as long you did. The Ring didn&#39;t have enough power to sway you from your mission.</p>\n<p>The Ring is destroyed.</p>\n<p>The volcano erupts and you flee from the mountain as it collapses.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue200\" role=\"link\" tabindex=\"0\">Outside, you watch Mordor get destroyed.</a></p>",
		'passages': {
		},
	},
	'_continue200': {
		'text': "<p>The orc armies vanish under crumbling earth. Sauron&#39;s tower explodes in a fantastic display. The Witch King falls from the sky.</p>\n<p>As you run from the lava, you see Faramir and his men riding out to meet you. It seems they felt guilty about sending you alone and came to help. Faramir gathers you on his horse and you all leave Mordor together.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Faramir takes you to Minas Tirith as a guest of honour.\" role=\"link\" tabindex=\"0\">Faramir takes you to Minas Tirith as a guest of honour.</a></p>",
		'passages': {
		},
	},
	'And then decide not to.': {
		'text': "<p>This is YOUR Ring. You don&#39;t care how far you walked or how many people you abandoned. You walked it, you fed it, and you brought it home! You&#39;re the only one worthy enough to keep it! Everyone should bow before your greatness!</p>\n<p>You slip it on and declare yourself King of Middle-Earth. You do a little Frodo dance to rejoice and leave Mt. Doom.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue201\" role=\"link\" tabindex=\"0\">You greet Mordor.</a></p>",
		'passages': {
		},
	},
	'_continue201': {
		'text': "<p>Standing atop its mountain, you shout at Mordor that you are its master now. You demand chicken wings and mead for your troubles, and shoes for your feet because you&#39;re sick of being barefoot all the time.</p>\n<p>The Flaming Eye of Sauron glares at you from atop its tower. All of Sauron&#39;s army down below turns in your direction and advances on Mt. Doom.</p>\n<p>Suddenly, this whole &quot;keep the Ring&quot; thing looks bad in hindsight.</p>\n<p>Thousands of orcs storm the mountain towards you. The Witch King can be seen flying your way.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You retreat back inside the mountain.\" role=\"link\" tabindex=\"0\">You retreat back inside the mountain.</a></p>",
		'passages': {
		},
	},
	'You retreat back inside the mountain.': {
		'text': "<p>You don&#39;t have any allies, so you&#39;ve have to fight all of Mordor on your own. You have the Ring on your side, but invisibility will only take you so far. You fish around in your bag for anything you can use to defend yourself.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue202\" role=\"link\" tabindex=\"0\">You find the Light of Lothlorien.</a></p>",
		'passages': {
		},
	},
	'_continue202': {
		'text': "<p>Opening the phial, it shines a holy elven light. As the orcs breach the cave, you blind them with its power and catch them off-guard.</p>\n<p>Still invisible, you lunge forward with {if hasSwordSting=0:your blade}{if hasSwordSting=1:Sting} and begin cutting down orcs left and right. You create a bottleneck with their corpses, forcing the army to find a better entrance.</p>\n<p>{if hasSeed=1:You throw Galadriel&#39;s magic seed at the ground. It sprouts into a giant bushel of vines and seals off the cave entrance, keeping the army out and giving you a breather.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue203\" role=\"link\" tabindex=\"0\">Ladders drop down over the volcano rim.</a></p>",
		'passages': {
		},
	},
	'_continue203': {
		'text': "<p>Orcs are climbing down into Mt. Doom! You quickly push the ladders away from the wall, dropping orcs into the lava below. First dozens, then hundreds. When they start dropping ropes, you set them alight with a hand-made torch.</p>\n<p>{if hasSeed=0:You continue hacking away at the orcs squeezing in through the entrance.}</p>\n<p>You&#39;ve never felt so alive! You&#39;re a one-hobbit army in the heart of Doom, fighting for your Precious! Even when the orcs bring their wargs and oliphaunts up the mountain, you tear them down with all of your newfound power! Every swing of your sword sends their units flying! This is how Sauron must have felt during the last War of the Ring so long ago!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue204\" role=\"link\" tabindex=\"0\">You see the Witch King descend through the mountaintop.</a></p>",
		'passages': {
		},
	},
	'_continue204': {
		'text': "<p>The winged beast bears down and snatches you from the edge of the pit. You flail in the air as it lifts you up and out of the volcano.</p>\n<p>But as you come up over the rim, an arrow catches the beast in the neck. The King falls backwards, tumbling into the pit of lava below. You land outside the mountain with the beast and roll down the slope towards the orc army below.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue205\" role=\"link\" tabindex=\"0\">That&#39;s when you see the horses.</a></p>",
		'passages': {
		},
	},
	'_continue205': {
		'text': "<p>Faramir and his men ride up the mountain, slaughtering the orcs from behind. The orcs are taken by surprise again and retreat higher up the mountain where they are forced into the volcano and disappear into the lava below.</p>\n<p>It&#39;s an incredible bloody battle that&#39;s over in minutes.</p>\n<p>The horses stop riding and Faramir approaches you. At first, you think he can&#39;t see you, but you&#39;re covered in orc blood and pretty visible at this point. You take off the Ring.</p>\n<p>&quot;You had ONE JOB, Frodo,&quot; he says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue206\" role=\"link\" tabindex=\"0\">His men seize you.</a></p>",
		'passages': {
		},
	},
	'_continue206': {
		'text': "<p>You refuse to let go of the Ring, so they drag you back inside the mountain, shouting &quot;Let it go! Just <a class=\"squiffy-link link-section\" data-section=\"let it go already!\" role=\"link\" tabindex=\"0\">let it go already!</a>&quot; You continue to <a class=\"squiffy-link link-section\" data-section=\"hold onto the Ring\" role=\"link\" tabindex=\"0\">hold onto the Ring</a>.</p>",
		'passages': {
		},
	},
	'let it go already!': {
		'text': "<p>Your drop the Ring. Faramir snatches it up and doesn&#39;t give its power a second thought.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Faramir throws the Ring into Mt. Doom.\" role=\"link\" tabindex=\"0\">Faramir throws the Ring into Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'hold onto the Ring': {
		'text': "<p>Faramir repeatedly stomps on your hand until you let go. He then snatches it up.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Faramir throws the Ring into Mt. Doom.\" role=\"link\" tabindex=\"0\">Faramir throws the Ring into Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'Faramir throws the Ring into Mt. Doom.': {
		'text': "<p>All the men cheer momentarily before the volcano erupts. You all flee from the collapsing cave and ride off on your horses. You watch as all the orcs get swallowed up by the earth and vanish off the face of Mordor.</p>\n<p>Sauron&#39;s tower explodes and Mordor is defeated, no thanks to you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue207\" role=\"link\" tabindex=\"0\">Faramir takes you back to Minas Tirith.</a></p>",
		'passages': {
		},
	},
	'_continue207': {
		'text': "<p>You&#39;re kept prisoner there until one day, the Fellowship arrives.{if gandalfDead=1: You discover Gandalf is alive, and now sporting white robes.} Gandalf glares at you as he drags you from your cell.</p>\n<p>&quot;You had ONE JOB, Frodo!&quot; he snaps, &quot;ONE JOB!&quot;</p>\n<p>{if gandalfAngry&gt;9:He stops, drops you, and kicks you several times for his trouble. This has been a long time coming and you totally deserve it.}</p>\n<p>{if boromirDead=0:Boromir meets up with Faramir. Faramir promptly slaps his brother&#39;s head and scolds him for trying to take the Ring.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue208\" role=\"link\" tabindex=\"0\">Gandalf fills you in on their journey.</a></p>",
		'attributes': ["gandalfAngry+=1","gandalfAngry+=1"],
		'passages': {
		},
	},
	'_continue208': {
		'text': "<p>Long story short, the Fellowship went into Rohan,{if merryPippinInRohan=1: saved Merry and Pippin,} defeated Saruman,{if merryPippinInRohan=1: made tree friends,} and was on their way to come help you before you screwed up. You tell Gandalf about your journey and he just grumbles.</p>\n<p>&quot;This has been a big stupid mess,&quot; he sneers. &quot;One job, Frodo. ONE JOB.&quot;</p>\n<p>As a side-note, Aragorn declares that he has the reforged sword of Anduril and is rightful heir to Gondor. But King Denethor kicks him out, so he, Gimli, and Legolas just kind of wander off. {if fellowship&lt;3:The rest of the Fellowship follow them, not having much else to do.}{if merryPippinInRohan=1:Merry and Pippin join them, embarrassed to be seen with you.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue209\" role=\"link\" tabindex=\"0\">Gandalf takes you home.</a></p>",
		'passages': {
		},
	},
	'_continue209': {
		'text': "<p>&quot;ONE JOB. ONE JOB!&quot; he repeats all the way back to the Shire.</p>\n<p>He drops you off at Bag End and leaves without a goodbye.</p>\n<p>In hindsight, you think a lot of your adventure could&#39;ve gone better. But it could&#39;ve been worse. Going into Mordor alone and caving into the Ring&#39;s power is probably only the second or third worst outcome that could&#39;ve happened on that mountain. As least you made it back home alive. So you think you did pretty well.</p>\n<p>{if hasButterKnife=0:You make yourself {if jam=0:a spot of tea}{if jam=1:some jam with bread} and declare your journey over.}\n{if hasButterKnife=1:You return your butterknife to the kitchen and declare your journey over.}</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'Faramir takes you to Minas Tirith as a guest of honour.': {
		'text': "<p>You regale the people of the White City of your adventures. When word gets out that the Fellowship is in Rohan, Faramir&#39;s people ride out to help them in their fight against Saruman. It&#39;s an amazing battle that brings everyone closer together. {if boromirDead=0:Faramir and Boromir meet up once more and make up their past differences. Brothery love finds a way.}</p>\n<p>{if gandalfDead=1:You are delighted to discover Gandalf is alive, and sporting cool white duds. He seems happy that you completed the mission, although he wishes you didn&#39;t go alone.}</p>\n<p>Aragorn announces that maybe he could be the new King of Gondor, but King Denethor politely sends him on his way. Legolas and Gilmi go with him. {if fellowship&lt;3:The rest of the Fellowship follow them, not having much else to do.}{if merryPippinInRohan=1:Merry and Pippin stick with you.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue210\" role=\"link\" tabindex=\"0\">Gandalf takes you back to the Shire.</a></p>",
		'passages': {
		},
	},
	'_continue210': {
		'text': "<p>{if samDrowned=1:&quot;Where&#39;s Sam?&quot; someone asks at some point. You tell them Sam died bravely. A big Chia statue of Sam is erected in Hobbiton Square, next to his favourite garden.}</p>\n<p>You resettle back into Bag End and get back to your normal life. You feel like your journey reached an anticlimatic, yet successful end. You probably could&#39;ve done better, but you&#39;re happy you did that last stretch by yourself. You wonder how you could&#39;ve done any of it better.</p>\n<p>{if samDrowned=1: Maybe you could&#39;ve at least fished Sam out of the water. Letting him drown was a real jerk move on your part.}</p>\n<p>But hey, Ring&#39;s gone, and you&#39;re home. {if merryPippininRohan=1:Merry and Pippin seem happy too. You&#39;re glad they didn&#39;t die.{if samDrowned=1: Unlike Sam, you monster.}}</p>\n<p>Gandalf sets off to do wizard stuff and you put up your feet on your favourite pillow and high-five yourself. </p>\n<p>Thus ends THE LORD OF THE RINGS. </p>\n<p>Congratulations! You went in and did the thing by yourself! You&#39;ve completed the bare mininum ending! Good job!</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'The Ring suddenly feels ice cold.': {
		'text': "<p>Merry and Pippin are dead. Uncle Bilbo is dead. Gandalf is dead. And now Samwise Gamgee, your beloved gardener, is dead. Everyone you&#39;ve traveled with from the Shire is dead. </p>\n<p>You realize your terrible choices have killed them all. Your despair sinks so low, even the Ring wants to get away from you.</p>\n<p>You drop to your knees and cry. Everyone in the cave feels very uncomfortable.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue211\" role=\"link\" tabindex=\"0\">You cry for hours, hating yourself.</a></p>",
		'passages': {
		},
	},
	'_continue211': {
		'text': "<p>Faramir occasionally checks in with you. You&#39;re still crying. He wants to know if you want to <a class=\"squiffy-link link-section\" data-section=\"go destroy the Ring\" role=\"link\" tabindex=\"0\">go destroy the Ring</a> yet. But you can&#39;t handle the pressure anymore. If you thought you were low before, you were wrong. This is the darkest path. You&#39;re alone, sad, pathetic, and undeserving of any friend.</p>\n<p>Faramir quietly leaves you alone to <a class=\"squiffy-link link-passage\" data-passage=\"cry some more\" role=\"link\" tabindex=\"0\">cry some more</a>.</p>",
		'passages': {
			'cry some more': {
				'text': "<p>You cry even longer, but you really should <a class=\"squiffy-link link-section\" data-section=\"go destroy the Ring\" role=\"link\" tabindex=\"0\">go destroy the Ring</a>.</p>",
			},
		},
	},
	'go destroy the Ring': {
		'text': "<p>You offer the Ring to Faramir and ask him to go destroy it for you. He&#39;s quick to decline. He doesn&#39;t even want to go near the Ring. Something about its power repels him now. Instead, he draws you a map into Mordor.</p>\n<p>&quot;It&#39;s an old trading route,&quot; he explains. &quot;Just a long, lonesome road. Orcs don&#39;t use it, and it&#39;s too rocky for my men, but it should take you straight to Mt. Doom. Please, go, and destroy that Ring. My men can&#39;t stand to be anywhere near it... or you.&quot;</p>\n<p>He gives you some supplies, including tissues, and you leave the cave. You&#39;re escorted to a hidden path through the mountains leading into Mordor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue212\" role=\"link\" tabindex=\"0\">You set off down the long, lonesome road.</a></p>",
		'passages': {
		},
	},
	'_continue212': {
		'text': "<p>The night sets.</p>\n<p>You greet the darkness as an old friend.</p>\n<p>Your tired hobbit feet carry you through miles and miles of stone terrain, cutting through the mountains. Eventually, you cross into Mordor and see the orc encampments across the fields. You even see the great tower of Barad-dûr, with a giant flaming eye atop it.</p>\n<p>Mt. Doom is ahead. Nothing stands in your way.</p>\n<p>{if eaglesComing=0:<a class=\"squiffy-link link-section\" data-section=\"You decide to stop and cry a LOT.\" role=\"link\" tabindex=\"0\">You decide to stop and cry a LOT.</a>}\n{if eaglesComing=1:<a class=\"squiffy-link link-section\" data-section=\"You suddenly see eagles coming.\" role=\"link\" tabindex=\"0\">You suddenly see eagles coming.</a>}</p>",
		'passages': {
		},
	},
	'You decide to stop and cry a LOT.': {
		'text': "<p>You really haven&#39;t grieved for anyone since you left. For the first time, you now fully blame yourself for everything that&#39;s gone wrong. This isn&#39;t the journey you were promised. </p>\n<p>All you want to do now is throw away the Ring, go home, and hope your warm bed will still have you after all this.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pick yourself up and continue to the volcano.\" role=\"link\" tabindex=\"0\">You pick yourself up and continue to the volcano.</a></p>",
		'passages': {
		},
	},
	'You suddenly see eagles coming.': {
		'text': "<p>The great birds descend upon you quickly. You can&#39;t over-maneuver them in these rocks and you quickly find yourself surrounded as the giant birds perch on the stones.</p>\n<p>Their scarred leader inspects you carefully, and then speaks to his subordinates, &quot;This is the halfling we&#39;re looking for, but... something has changed. The Ring... its power is tainted. We mustn&#39;t take him back with us.&quot;</p>\n<p>The eagles don&#39;t protest. Instead, they fly away without hesitation, eager to put some distance between them and you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pick yourself up and continue to the volcano.\" role=\"link\" tabindex=\"0\">You pick yourself up and continue to the volcano.</a></p>",
		'passages': {
		},
	},
	'You pick yourself up and continue to the volcano.': {
		'text': "<p>Near the foot of the mountain, you run into a gang of orcs. They sense the power of the Ring on you and immediately step aside. Not out of respect, but out of sheer pity. This strange hobbit who just arrived in their land seems less like a threat, and more like the saddest sob story on two legs. Your self-pity is actually toxic to them.</p>\n<p>You look up at the great flaming eye of Sauron and notice it looks more irritated than usual. It almost looks as if it&#39;s ready to cry with you.</p>\n<p>{if witchKingDanceOff=0:You see the Witch King fly past, and he pretends not to see you. This is how bad things have gotten.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue213\" role=\"link\" tabindex=\"0\">Sad and defeated by life, you climb Mt. Doom and enter a cave.</a></p>",
		'passages': {
		},
	},
	'_continue213': {
		'text': "<p>Welcome to the end of your journey, Frodo. You stand on a precipice overlooking a river of lava. Everything has led to this moment.</p>\n<p>All you have do to is <a class=\"squiffy-link link-section\" data-section=\"drop the Ring in\" role=\"link\" tabindex=\"0\">drop the Ring in</a>. Or <a class=\"squiffy-link link-passage\" data-passage=\"cry more\" role=\"link\" tabindex=\"0\">cry more</a> if that helps.</p>",
		'passages': {
			'cry more': {
				'text': "<p>You cry more. It doesn&#39;t help at all.</p>",
			},
		},
	},
	'drop the Ring in': {
		'text': "<p>You drop the Ring into the fires of Mt. Doom.</p>\n<p>A spurt of lava explodes and the Ring flies back up and lands at your feet.</p>\n<p>Maybe you should <a class=\"squiffy-link link-section\" data-section=\"drop the Ring in again\" role=\"link\" tabindex=\"0\">drop the Ring in again</a>?</p>",
		'passages': {
		},
	},
	'drop the Ring in again': {
		'text': "<p>You drop it in one more time. The volcano is quick to spit it out.</p>\n<p>You <a class=\"squiffy-link link-section\" data-section=\"keep throwing it in\" role=\"link\" tabindex=\"0\">keep throwing it in</a>.</p>",
		'passages': {
		},
	},
	'keep throwing it in': {
		'text': "<p>This is ridiculous. No matter how hard you throw, no matter how many times, the Ring just keeps coming back to you. Mt. Doom absolutely won&#39;t take it.</p>\n<p>You&#39;ve failed completely, Frodo. This is the one path where you can&#39;t destroy the Ring. Instead, your choices have cost you everyone that mattered to you. You have become so sad and pathetic, you overwhelmed Sauron&#39;s shadow and tainted the Ring with your failure.</p>\n<p>The Ring&#39;s power stems from you now. It will no longer tempt anyone or bring about war. It will only sadden anyone who comes near it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue214\" role=\"link\" tabindex=\"0\">You roll over and wait to die.</a></p>",
		'passages': {
		},
	},
	'_continue214': {
		'text': "<p>You never do, though. Even Death doesn&#39;t want to be near you. So you stay in Mt. Doom as a miserable hermit and become the Master of Doom.</p>\n<p>Eventually, Gandalf comes to save you, but regrets it immediately upon seeing how broken you&#39;ve become. {if gandalfDead=1:You&#39;re only barely happy to see him alive, but the damage is done. You are devoid of true happiness. }He leaves you to your fate in Mordor, goes home, and tells everyone you&#39;re dead because you might as well be.</p>\n<p>So you never learn what became of the Fellowship, or the rest of Middle-Earth. Even the forces of Mordor quiet down and actively avoid the mountain because of all your crying. Some nights, you wonder what became of Aragorn, the Fellowship, Saruman, and all those other loose ends. But you&#39;re sure it all turned out fine.</p>\n<p>War is averted because you suck at quests. Nice job, Frodo.</p>\n<p>{if jam=0:This so wasn&#39;t worth the cup of tea.}\n{if jam=1:This so wasn&#39;t worth the toast and jam.}</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'you see the army suddenly panic.': {
		'text': "<p>The orcs begin throwing spears into the air and shouting, &quot;Death from above! Kill them! Kill them all, quickly!&quot;</p>\n<p>Hundreds of orcs scramble. You see shadows dive down and scoop orcs into the air, just to dash them on the rocks. A great battle is happening right here at the Black Gate and you can barely make out any of it.</p>\n<p>One orc crawls away from the fiasco and heads towards you. Distracted by his attackers, he doesn&#39;t see you until he&#39;s right up close.</p>\n<p>&quot;Hey!&quot; he exclaims, &quot;A halfling! I found a halfling here!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue215\" role=\"link\" tabindex=\"0\">Sharp talons skewer him in the back.</a></p>",
		'passages': {
		},
	},
	'_continue215': {
		'text': "<p>A great eagle stands on the ground and tosses the orc aside with one clawed foot. You look into its scarred face and see a deep hunger for that Ring around your neck.</p>\n<p>The eagle leans forward and sees its tiny golden reflection in the Ring. But it hesitates to take it. Instead it scoops you up with one foot and flies into the sky.</p>\n<p>&quot;I found the halfling!&quot; it shouts to the other eagles as they battle the orcs. &quot;Fall back and return to the Eyrie!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are taken into the skies and away from Mordor.\" role=\"link\" tabindex=\"0\">You are taken into the skies and away from Mordor.</a></p>",
		'passages': {
		},
	},
	'You are taken into the skies and away from Mordor.': {
		'text': "<p>You are carried for miles and miles across Middle-Earth in the wrong direction. The eagles could&#39;ve flown the Fellowship into Mordor very quickly, but Gandalf was wise to keep the mission a secret from them. It seems eagles are totally Ring-crazy.</p>\n<p>You taken high into the Misty Mountains where you are flown onto a great shelf on the side of the tallest mountain and dropped into a huge nest. You have arrived at the EYRIE OF THE EAGLES.</p>\n<p>Dozens of eagles perch on the rocks above you. The scarred one caws loudly as if to cheer.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue216\" role=\"link\" tabindex=\"0\">Suddenly, an even bigger eagle arrives.</a></p>",
		'passages': {
		},
	},
	'_continue216': {
		'text': "<p>Accompanied by a half dozen followers, this eagle doesn&#39;t appear malicious towards you. He&#39;s more focused on the scarred one as he lands on a perch and speaks. The Ring allows you to hear him:</p>\n<p>&quot;Meneldor, what is the meaning of this?&quot; the huge eagle shouts. &quot;Why have you brought the wizard&#39;s pet into our home?&quot;</p>\n<p>The scarred one shrieks, &quot;Hold your tongue, Gwaihir! While you were off running errands for that old fool, we&#39;ve brought home a prize beyond prizes!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue217\" role=\"link\" tabindex=\"0\">Gwaihir sees your Ring and goes mad with fury.</a></p>",
		'passages': {
		},
	},
	'_continue217': {
		'text': "<p>&quot;You brought the One Ring into our Eyrie?&quot; he shouts at Meneldor. &quot;You know the eagles must never wield this kind of power! You have brought ruin upon our convocation!&quot;</p>\n<p>&quot;I have brought a new age of glory for the eagles,&quot; Meneldor declares. &quot;With it, I shall rise up and become our new lord! And you shall be dashed upon the rocks and eaten! Attack, my brothers!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue218\" role=\"link\" tabindex=\"0\">Meneldor&#39;s eagles attack Gwaihir&#39;s.</a></p>",
		'passages': {
		},
	},
	'_continue218': {
		'text': "<p>You watch in horror as the two groups battle in the skies above. Meneldor&#39;s eagles overwhelm Gwaihir quickly and the Lord of the Eagles is slashed from the sky and lands in your nest, DEAD. Gwaihir&#39;s eagles quickly surrender.</p>\n<p>&quot;Behold!&quot; Meneldor declares, &quot;I am your new Lord! And with this Ring, we shall raze mankind from Middle-Earth once and for all!&quot;</p>\n<p>He flies down to snatch the Ring from you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue219\" role=\"link\" tabindex=\"0\">Before he can take it, you are grabbed and swept from the nest.</a></p>",
		'passages': {
		},
	},
	'_continue219': {
		'text': "<p>Meneldor shrieks in surprise and pursues you immediately.</p>\n<p>You discover you&#39;ve been collected by one of Gwaihir&#39;s eagles.</p>\n<p>&quot;I am Landroval, brother of Gwaihir,&quot; the eagle says. &quot;We must <a class=\"squiffy-link link-section\" data-section=\"take that Ring back to Mordor\" role=\"link\" tabindex=\"0\">take that Ring back to Mordor</a> and destroy it immediately! We can&#39;t <a class=\"squiffy-link link-section\" data-section=\"let Meneldor have it\" role=\"link\" tabindex=\"0\">let Meneldor have it</a>.&quot;</p>",
		'passages': {
		},
	},
	'let Meneldor have it': {
		'text': "<p>Like a total stinker, you drop the Ring.</p>\n<p>Landroval screeches, as if to shout, &quot;WTF, BRO?!?&quot;</p>\n<p>Meneldor dives down and uses eagle-like precision to snatch the Ring in mid-fall. He abandons his pursuit and allows you and Landroval to escape.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue220\" role=\"link\" tabindex=\"0\">Landroval lands on another peak with you.</a></p>",
		'passages': {
		},
	},
	'_continue220': {
		'text': "<p>&quot;I can&#39;t believe you let him have it! He killed my brother! Do you know what kind of power that Ring holds over eagles? We&#39;re one of Middle-Earth&#39;s most ancient races! We have no will to resist its thrall! It&#39;ll overwhelm us in hours if it stays on this mountain!&quot;</p>\n<p>You tell him to chill.</p>\n<p>&quot;I WILL NOT CHILL!&quot; he says as he calls for reinforcements. </p>\n<p>Soon, you are accompanied by three more eagles named Thoron, Belarus, and Sam.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue221\" role=\"link\" tabindex=\"0\">Landroval plans the heist.</a></p>",
		'passages': {
		},
	},
	'_continue221': {
		'text': "<p>&quot;We&#39;ll disguise ourselves and sneak back into the Eyrie,&quot; he says. &quot;Thoron and Belarus, you need to infiltrate Meneldor&#39;s ranks and take out his personal guard. Sam, you&#39;re on dive-bomb duty. Frodo, I need you as a distraction while I take the Ring back from Meneldor.&quot;</p>\n<p>You ask why you have to do it.</p>\n<p>&quot;BECAUSE YOU DROPPED THE RING,&quot; Landroval reminds you. &quot;Now let&#39;s go!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue222\" role=\"link\" tabindex=\"0\">The con is on.</a></p>",
		'passages': {
		},
	},
	'_continue222': {
		'text': "<p>The eagles cover you in mud and feathers, then poop on you for good measure. You looks like an ugly little eaglet now. They slap on some mud to disguise themselves and you all fly back to the Eyrie. At some point, Thoron, Belarus, and Sam break off, leaving you on a mountain trail.</p>\n<p>You approach a mountain peak guarded by two of Meneldor&#39;s guards. They watch over a cave leading into the mountain.</p>\n<p>&quot;Halt!&quot; one says, seeing you ride in on Landroval, &quot;Who are you and what is this ugly little creature?&quot;</p>\n<p>&quot;I am Eegylynhall,&quot; Landro speaks. &quot;This is my son, Eggsy. It&#39;s Bring-Your-Son-To-Work day today, correct?&quot;</p>\n<p>&quot;He don&#39;t look like an eaglet,&quot; a guard says. &quot;Hey, you! <a class=\"squiffy-link link-section\" data-section=\"Say something only an eagle would say!\" role=\"link\" tabindex=\"0\">Say something only an eagle would say!</a>&quot;</p>\n<p>You&#39;re so nervous, you feel like you could <a class=\"squiffy-link link-section\" data-section=\"throw up on Landroval\" role=\"link\" tabindex=\"0\">throw up on Landroval</a>.</p>",
		'passages': {
		},
	},
	'Say something only an eagle would say!': {
		'text': "<p>&quot;Caw, caw!&quot; you shriek.</p>\n<p>&quot;Yeah, that stands,&quot; a guards says. &quot;Head on in.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You fly into the mountain.\" role=\"link\" tabindex=\"0\">You fly into the mountain.</a></p>",
		'passages': {
		},
	},
	'throw up on Landroval': {
		'text': "<p>Both guards watch in surprise as you vomit on Landro&#39;s back. Even Landro seems surprised.</p>\n<p>One guard speaks, &quot;Yeah, my son does that too. Go on in.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You fly into the mountain.\" role=\"link\" tabindex=\"0\">You fly into the mountain.</a></p>",
		'passages': {
		},
	},
	'You fly into the mountain.': {
		'text': "<p>You enter a large cavern and see a vast army of eagles scattered across the walls and floors, feverishly working with their talons. They appear to be carving armour and weapons out of the rock. Some eagles are already clad in battle-armour, while others bang rocks on rocks to make swords.</p>\n<p>&quot;Meneldor is raising an army,&quot; Landro says. &quot;We must stop him now.&quot;</p>\n<p>You see Meneldor in a throne-nest at the back of the room. He wears the One Ring over a talon and commands his followers to work harder.</p>\n<p>They sing: <I><BR>&quot;Crack the stone and break the chocks! <BR>Dash mankind against the rocks! <BR>Lords of Sky reclaim the land! <BR>Bring our glory back again!&quot;</I></p>\n<p>Landro drops you off. &quot;Just keep him busy. I&#39;ll do the rest.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue223\" role=\"link\" tabindex=\"0\">You approach Meneldor.</a></p>",
		'passages': {
		},
	},
	'_continue223': {
		'text': "<p>&quot;Hey, little eaglet,&quot; he says, &quot;You should fly on home. This is no place for a little one.&quot;</p>\n<p>You wonder how you can distract a big eagle like this. You suppose you could <a class=\"squiffy-link link-section\" data-section=\"try a little dance\" role=\"link\" tabindex=\"0\">try a little dance</a>, but maybe you could <a class=\"squiffy-link link-section\" data-section=\"engage him in a game of riddles\" role=\"link\" tabindex=\"0\">engage him in a game of riddles</a>.</p>",
		'passages': {
		},
	},
	'try a little dance': {
		'text': "<p>Your toes start tapping and you&#39;re suddenly on top of the world. Meneldor is immediately distracted by your happy feet as you flap your fake wings and waddle around gleefully.</p>\n<p>&quot;Hey, that&#39;s pretty cute, kid,&quot; he says. &quot;Everybody, stop what you&#39;re doing and look at this!&quot;</p>\n<p>All eyes are on the ugly little bird doing the silliest dance you can muster up.</p>\n<p>They all begin to dance along. Look what you started!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Your cover is suddenly blown.\" role=\"link\" tabindex=\"0\">Your cover is suddenly blown.</a></p>",
		'passages': {
		},
	},
	'engage him in a game of riddles': {
		'text': "<p>You innocently ask him if he knows the answer to a riddle that&#39;s been confusing you. Of course, you need a real head-scratcher, so you make up a very convoluted riddle with no discernible answer.</p>\n<p>Meneldor scratches his head in confusion. &quot;What has seventeen feet, but doesn&#39;t walk? Thirty-five eyes, but can&#39;t see? And three hearts, but cannot love? That&#39;s, uh... well... that&#39;s a real stumper. Listen, kid, this isn&#39;t the best time for riddles, so...&quot;</p>\n<p>You start to cry.</p>\n<p>&quot;Okay, okay! Uh, maybe it&#39;s some kind of sea life. What about sea cucumbers? Jellyfish? How many feet and hearts do those have?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Your cover is suddenly blown.\" role=\"link\" tabindex=\"0\">Your cover is suddenly blown.</a></p>",
		'passages': {
		},
	},
	'Your cover is suddenly blown.': {
		'text': "<p>One eagle rips the feathers off your face, revealing the hobbit underneath. He questions why no one else sees through your disguise. Meneldor immediately orders you killed.</p>\n<p>Just then, Thoron and Belarus sneak up from behind and snap the necks of his two personal guards. Death begins raining from above as Sam Eagle showers the room with a small bag of rocks. The eagles scatter in surprise.</p>\n<p>&quot;This is for Gwaihir!&quot; Landro shouts, diving at Meneldor from behind.</p>\n<p>Meneldor snatches a stone-sword with his talons and spins around to parry Landro, who is also carrying a stone-sword. The two eagles fly across the room, clumsily swinging their swords at one another.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue224\" role=\"link\" tabindex=\"0\">Landro lands a strike.</a></p>",
		'passages': {
		},
	},
	'_continue224': {
		'text': "<p>Meneldor&#39;s foot comes off, dropping the Ring, which you catch. Landro then spins around and slashes Meneldor across the chest with his sword. The Great Eagle falls to the ground next to you, causing you to stumble and fall.</p>\n<p>{if hasSeed=1:As you fall, you drop Galadriel&#39;s seed from your bag. It plants itself at Meneldor&#39;s head, and huge vines suddenly erupt from the ground. They wrap around Meneldor and crush him instantly.}\n{if hasSeed=0:Landro dives down and drives his sword through Meneldor&#39;s head. The Great Eagle is now dead. Gwaihir has been avenged.}</p>\n<p>&quot;They killed our leader! Get them!&quot;</p>\n<p>Landro snatches you up and takes the Ring with one foot. &quot;Time to fly. And I&#39;ll be carrying the Ring this time.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue225\" role=\"link\" tabindex=\"0\">He escapes the mountain.</a></p>",
		'passages': {
		},
	},
	'_continue225': {
		'text': "<p>While your eagle friends stay to slow down Meneldor&#39;s supporters, Landroval catches a fortunate high wind towards Mordor, moving faster than possible across Middle-Earth. A few eagles take chase, but you soar higher and higher, gradually wearing them out.</p>\n<p>Immediately, you reach the top of the sky. It&#39;s cold here, and air is thin. Looking down, you see the fires of Mt. Doom. All you need to do now is dive into it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue226\" role=\"link\" tabindex=\"0\">But Landroval hesistates.</a></p>",
		'passages': {
		},
	},
	'_continue226': {
		'text': "<p>&quot;Perhaps Meneldor wasn&#39;t wrong,&quot; he says, eyeing the Ring. &quot;Perhaps the Ring SHOULD go to the eagles. Perhaps we SHOULD reclaim Middle-Earth.&quot;</p>\n<p>You feel his grip loosening on you. You beg him to drop the Ring.</p>\n<p>&quot;Why should I? The Ring came to ME. It&#39;s mine, you hear me? Gwaihir would want me to have it. In fact, I&#39;d sooner drop YOU into the fires. You&#39;re the one who caused this whole mess.&quot;</p>\n<p>You&#39;re miles above Mt. Doom in the claws of a power-hungry eagle, about to be dropped. Fumbling in your bag, you find the LIGHT OF GALADRIEL, but aren&#39;t sure if it can help you now. You could always <a class=\"squiffy-link link-section\" data-section=\"throw it at him\" role=\"link\" tabindex=\"0\">throw it at him</a>, but maybe you could <a class=\"squiffy-link link-section\" data-section=\"try using its light\" role=\"link\" tabindex=\"0\">try using its light</a>.</p>",
		'passages': {
		},
	},
	'throw it at him': {
		'text': "<p>You hurl the glass phial at Landroval&#39;s head. It shatters, spilling an acidic substance over his face. This was unexpected, but effective. As it burns, he drops both you and the Ring.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You plummet towards Mt. Doom.\" role=\"link\" tabindex=\"0\">You plummet towards Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'try using its light': {
		'text': "<p>You open the phial. A great light momentarily blinds Landroval and he drops both you and the Ring in surprise.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You plummet towards Mt. Doom.\" role=\"link\" tabindex=\"0\">You plummet towards Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You plummet towards Mt. Doom.': {
		'text': "<p>Landroval dives after the Ring. Waving your arms frantically, you manage to shoulder-check the eagle as he passes, causing him to spiral and go into a tail spin.</p>\n<p>As he falls, he snatches the Ring with his beak, but is unable to recover from his spin.</p>\n<p>You hold out your cape to slow your fall. You watch as Landroval falls into Mt. Doom with the Ring.</p>\n<p>Both the eagle and the Ring vanish into the lava. The Ring is DESTROYED.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue227\" role=\"link\" tabindex=\"0\">Mt. Doom erupts.</a></p>",
		'passages': {
		},
	},
	'_continue227': {
		'text': "<p>A massive gust of steam catches your cape and slows your falls even more. It burns, but the force is enough to propel you away from the volcano. As you fall, more geysers erupt along Mordor&#39;s landscape. Your cape catches their blasts, launching you further and faster out of Mordor and over the mountains.</p>\n<p>Eventually, you hit the ground hard. You crash into a mountain side, bounce through a fissure, and collide with solid earth, breaking half the bones in your body.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue228\" role=\"link\" tabindex=\"0\">This seems like a good place to pass out.</a></p>",
		'passages': {
		},
	},
	'_continue228': {
		'text': "<p>You are surprised to find yourself awakening in a white room. You see Gandalf here{if gandalfDead=1:, alive and well}! You yourself are wrapped in a full-body cast. You discover Aragon, Legolas, and Gimli are also here. {if boromirDead=0:So is Boromir! }{if merryPippinInRohan=1:And Merry and Pippin!}{if fellowship&lt;3:And Arwen and Glorfy!}</p>\n<p>&quot;You are in Minas Tirith,&quot; Gandalf says. &quot;Faramir, son of King Denethor, was patrolling the mountains when he saw you fall from the sky. He brought you here and saved your life. It&#39;s a miracle you survived such a fall, but not impossible it seems.&quot;</p>\n<p>He tells you that while you ran off, the rest of them saved Rohan from Saruman. And then Mt. Doom erupted and all the orcs were destroyed by it. You tell him that some crazy stuff went down with the eagles, and Gandalf shouldn&#39;t expect any further favours from them.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue229\" role=\"link\" tabindex=\"0\">King Denethor throws a party to celebrate your victory.</a></p>",
		'passages': {
		},
	},
	'_continue229': {
		'text': "<p>The Ring is gone, Sauron and Saruman are defeated, and Middle-Earth is saved. The Fellowship breaks up and you go your separate ways.</p>\n<p>Of course, you return to Hobbiton to tell the others of your adventures. Naturally, no one believes you when you tell them about the eagles. {if merryPippinInRohan=1:But you like to think your story is at least more credible than Merry and Pippin telling everyone they met a talking tree.}</p>\n<p>And that&#39;s the end of your amazing Middle-Earth adventure! Maybe next time, you should try not letting Melendor have the Ring and see what happens? Or maybe don&#39;t get caught by eagles at all! Or maybe even stay out of Mordor! Or even try keeping Sam alive! Wow, so many possibilities!</p>\n<p>Anyway, good job! That was fun! Play again real soon, okay?</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'take that Ring back to Mordor': {
		'text': "<p>You climb on top of Landroval and tell him to book it. He flies off towards Mordor with several dozen of Meneldor&#39;s eagles in hot pursuit.</p>\n<p>&quot;The wind&#39;s too strong in this direction,&quot; he says, &quot;We need to take the scenic route!&quot;</p>\n<p>With that, he veers south and downwards in the direction of Rohan, picking up speed as he goes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue230\" role=\"link\" tabindex=\"0\">He dives further into the mountains, trying to lose the eagles.</a></p>",
		'passages': {
		},
	},
	'_continue230': {
		'text': "<p>An epic chase ensues as you and Landroval dodge and weave through the mountain peaks. Meneldor&#39;s birds aren&#39;t skilled enough to navigate these low altitudes. Many collide with mountains, exploding on impact.</p>\n<p>You cut through the pass and happen upon an extraordinary sight. Ahead of you is the tower of Orthanc - Saruman&#39;s tower at Isengard - and it&#39;s under attack by giant tree people!</p>\n<p>You see an orc light a flaming catapult and fire it in your direction.</p>\n<p>&quot;Quick, Frodo!&quot; Landroval says, &quot;<a class=\"squiffy-link link-section\" data-section=\"Nose-dive\" role=\"link\" tabindex=\"0\">Nose-dive</a> or <a class=\"squiffy-link link-section\" data-section=\"do a barrel roll\" role=\"link\" tabindex=\"0\">do a barrel roll</a>?&quot;</p>",
		'passages': {
		},
	},
	'Nose-dive': {
		'text': "<p>You tell Landroval to get closer to the ground. </p>\n<p>He overshoots his mark and doesn&#39;t pull up in time. He dives into a deep cavern below the tower and knocks over miles of underground scaffolding. The entire cave collapses behind you, sucking in Saruman&#39;s army. The tree people dig their roots into the stable earth and survive the collapse. </p>\n<p>As you pull up out of the cave, you collide with some ropes and fall backwards off the eagle&#39;s back. You ankle gets wrapped up in a rope, which Landroval grabs onto.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are now dangling upside-down from the eagle.\" role=\"link\" tabindex=\"0\">You are now dangling upside-down from the eagle.</a></p>",
		'passages': {
		},
	},
	'do a barrel roll': {
		'text': "<p>You tell Landroval to try spinning, because that&#39;s a good trick.</p>\n<p>He barrel rolls right into Saruman&#39;s tower. He crashes through a window and slides through Saruman&#39;s laboratory, knocking over his potions and magical artifacts. Saruman himself flees in terror as this crazy giant bird comes straight for him. You and Landroval crash through the opposite window, knocking Saruman off his balcony.</p>\n<p>In the process, you get tangled in Saruman&#39;s curtains and fall off the eagle&#39;s back. Landroval grabs onto the curtain as your ankle gets wrapped in it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are now dangling upside-down from the eagle.\" role=\"link\" tabindex=\"0\">You are now dangling upside-down from the eagle.</a></p>",
		'passages': {
		},
	},
	'You are now dangling upside-down from the eagle.': {
		'text': "<p>Behind you, you see several more eagles get struck from the air by catapults, and several more get swatted by the tree people.</p>\n<p>In a bizarre turn, you think you see Merry and Pippin waving at you from one of the trees.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue231\" role=\"link\" tabindex=\"0\">Landroval flees Isengard with the other eagles still on his tail.</a></p>",
		'passages': {
		},
	},
	'_continue231': {
		'text': "<p>Several minutes later, you happen upon a mountain fortress. An armament of 10,000 orcs strong are attacking a small army of humans. Somehow, the humans are winning!</p>\n<p>Down below on the battlefield, you are surprised to see a familiar face in familiar grey robes. It&#39;s Gandalf, and he&#39;s kicking butt!</p>\n<p>Gandalf and the Fellowship are down there on the battlefield! You tell Landroval to fly lower.</p>\n<p>Down below, you hear Aragorn calling out, &quot;The eagles are coming! The eagles are... oh, crap! Everybody run! The eagles are coming!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue232\" role=\"link\" tabindex=\"0\">Meneldor&#39;s eagles attack the battlefield.</a></p>",
		'passages': {
		},
	},
	'_continue232': {
		'text': "<p>As you fly over, Gandalf is surprised to see an upside-down Frodo coming straight for him. Your arms outreached, you collide with the wizard and lift him off the ground.</p>\n<p>Aragorn sees Gandalf in trouble and grabs onto his feet, only to get lifted up himself.</p>\n<p>Then Legolas grabs onto Aragorn&#39;s ankles.</p>\n<p>Then Gimli gets swept up by Legolas&#39; feet.</p>\n<p>Then Boromir tries to hop on, but misses. So he&#39;ll just stay at the battle then.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue233\" role=\"link\" tabindex=\"0\">You fly away from Helm&#39;s Deep with half the Fellowship dangling beneath you.</a></p>",
		'passages': {
		},
	},
	'_continue233': {
		'text': "<p>They are REALLY heavy. </p>\n<p>Gandalf shouts, &quot;Frodo Baggins, what the devil do you think you&#39;re doing? Land this thing now!&quot;</p>\n<p>You tell Gandalf no can do. This baby&#39;s heading straight for Mordor.</p>\n<p>As the winds carry you back towards Mordor, Meneldor&#39;s eagles close in.</p>\n<p>&quot;We could <a class=\"squiffy-link link-section\" data-section=\"use a little magic\" role=\"link\" tabindex=\"0\">use a little magic</a>, Frodo,&quot; Landroval says. &quot;Or maybe <a class=\"squiffy-link link-section\" data-section=\"put those weapons to use\" role=\"link\" tabindex=\"0\">put those weapons to use</a> while you&#39;re down there? One of those.&quot; </p>",
		'attributes': ["gandalfAngry+=1"],
		'passages': {
		},
	},
	'use a little magic': {
		'text': "<p>You tell Gandalf to use some magic against the eagles. With one arm, Gandalf aims his staff at your attackers and summons a fire-bolt. Suddenly, his staff ignites into a rocket stream and causes Landroval to spin furiously. The whole Fellowship spins around like a tornado, magic spells firing in all directions from Gandalf&#39;s staff.</p>\n<p>While many eagles are shot down, you see other magic spells land on different targets across the landscapes. Those giant statues you passed coming into Gondor get obliterated. A nice castle atop a Rohan hill is now in pieces. Mordor&#39;s big Black Gate is blown wide open.</p>\n<p>Then the entire Fellowship gets dizzy and throws up in all directions like the worst water show ever. You throw up in Gandalf&#39;s face.</p>\n<p>Magic was a bad idea.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You fly into Mordor.\" role=\"link\" tabindex=\"0\">You fly into Mordor.</a></p>",
		'attributes': ["gandalfAngry+=1"],
		'passages': {
		},
	},
	'put those weapons to use': {
		'text': "<p>You tell Legolas to shoot down the eagles. Legolas ties his hair around Aragorn&#39;s ankle, then suspends himself with two free hands. He takes out his bow and arrow and fires fifty arrows all at once. Each one hits an eagle, taking them all out of the sky. Now, only several remain.</p>\n<p>&quot;Let me try!&quot; Gimli says, hurling his axe. His axe strikes one eagle, bounces off, and strikes four more before bouncing back into his hand. Everyone is SUPER-IMPRESSED, even Gimli! He didn&#39;t know he could do that! </p>\n<p>He tries it again and immediately loses his axe.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You fly into Mordor.\" role=\"link\" tabindex=\"0\">You fly into Mordor.</a></p>",
		'passages': {
		},
	},
	'You fly into Mordor.': {
		'text': "<p>As you soar above the orc camps, the orcs shoot at you and the other eagles. The other eagles are easy targets and fall out of the sky. The orcs having the homefield advantage make it pretty clear that riding eagles into Mordor would&#39;ve been a bad choice to begin with.</p>\n<p>Now, only Meneldor is left pursuing you.</p>\n<p>&quot;Frodo, I&#39;m going to drop you!&quot; Landroval tells you as you approach Mt. Doom.</p>\n<p>As Meneldor bears down on him, Landroval suddenly veers upwards.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue234\" role=\"link\" tabindex=\"0\">He loops backwards over Meneldor and drops the Fellowship.</a></p>",
		'passages': {
		},
	},
	'_continue234': {
		'text': "<p>You all land on Meneldor&#39;s back.</p>\n<p>As Meneldor cranes his neck to see you, Aragorn stabs him through the head.</p>\n<p>The Great Eagle falls towards Mt. Doom and crash-lands in a cave. The whole Fellowship tucks and rolls as he slides into the heart of mountain, falls off a cliff, and lands in a pool of lava below.</p>\n<p>&quot;That was for my brother,&quot; Landroval says as he flies into the volcano.</p>\n<p>Everyone looks to you. </p>\n<p>&quot;This is it, Frodo,&quot; Aragorn says. &quot;Just <a class=\"squiffy-link link-section\" data-section=\"drop the Ring in and be done with it\" role=\"link\" tabindex=\"0\">drop the Ring in and be done with it</a>.&quot;</p>\n<p>But now that you&#39;ve come this far together, you should <a class=\"squiffy-link link-section\" data-section=\"part ways with the Ring properly\" role=\"link\" tabindex=\"0\">part ways with the Ring properly</a>.&quot;</p>",
		'passages': {
		},
	},
	'part ways with the Ring properly': {
		'text': "<p>You tell the Ring good-bye and give it a kiss. The Ring seems sad. You suddenly don&#39;t want to <a class=\"squiffy-link link-section\" data-section=\"drop the Ring in and be done with it\" role=\"link\" tabindex=\"0\">drop the Ring in and be done with it</a>. You want to <a class=\"squiffy-link link-section\" data-section=\"wear it one more time and call it yours\" role=\"link\" tabindex=\"0\">wear it one more time and call it yours</a>.&quot;</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'wear it one more time and call it yours': {
		'text': "<p>&quot;The Ring is MINE,&quot; you tell everyone as you slip it and turn invisible.</p>\n<p>&quot;NOPE,&quot; says Gandalf as he hits you with his staff. Aragorn, Legolas and Gimli quickly tackle you and force you to relinquish the Ring. After all that nonsense, they are not going to let this become another alternate story path.</p>\n<p>You become visible as the Ring slips from your finger. </p>\n<p>Gimli quickly kicks it into the lava.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Ring is destroyed down below.\" role=\"link\" tabindex=\"0\">The Ring is destroyed down below.</a></p>",
		'passages': {
		},
	},
	'drop the Ring in and be done with it': {
		'text': "<p>You drop it in. You don&#39;t feel like dragging this out.</p>\n<p>Everyone pats you on the shoulder. They are really proud of you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Ring is destroyed down below.\" role=\"link\" tabindex=\"0\">The Ring is destroyed down below.</a></p>",
		'passages': {
		},
	},
	'The Ring is destroyed down below.': {
		'text': "<p>&quot;Quick, hop on my back,&quot; Landroval says as the volcano begins to erupt.</p>\n<p>The Fellowship rides him out of the stack. You leave Mordor by air and return to the Misty Mountains where Landroval is declared LORD OF THE EAGLES.</p>\n<p>He then takes you back to Rohan to collect Merry, Pippin and Boromir.</p>\n<p>You fly around for a little searching for Sam and eventually find him at the bottom of a waterfall. You think he&#39;s dead, but then Landroval does some eagle CPR on Sam and saves his life. </p>\n<p>Sam&#39;s okay!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue235\" role=\"link\" tabindex=\"0\">The entire Fellowship has SURVIVED!</a></p>",
		'passages': {
		},
	},
	'_continue235': {
		'text': "<p>Parades march through Middle-Earth to celebrate your victory! This is your best day ever!</p>\n<p>You fly from town to town, telling your stories to the people. Everyone hangs on your every word! They are amazed at the amazing things you did to secure such a victory! Bringing all your hobbit friends along, traveling through the Pass of Caradhras, leaving Sam to drown... these were all elements that made your path possible.</p>\n<p>But the greatest thing everyone agrees on is toast with jam. If you hadn&#39;t had toast with jam all those months ago, none of this would be possible. Just imagine all the chaos that could&#39;ve unfolded if you had TEA. That would&#39;ve been a disaster!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue236\" role=\"link\" tabindex=\"0\">And so ends your journey.</a></p>",
		'passages': {
		},
	},
	'_continue236': {
		'text': "<p>You are declared King of the World by everyone. They raise statues of toast in your honour. Middle-Earth becomes Toaster-Earth, and you are the legend that all men, elves, and dwarves can agree on.</p>\n<p>Good job, Frodo! You won everything! Now you don&#39;t have to play again!</p>\n<p>It doesn&#39;t get better than this!</p>\n<p>THE REAL END!</p>",
		'passages': {
		},
	},
	'You journey to Mordor with Sam.': {
		'text': "<p>{if gandalfDead=1:{@gandalfWhite=1}}\n{if gandalfDead=1:{@boromirDead=1}}\n{if gandalfDead=0:{@boromirInRohan=1}}\n{if gandalfDead=0:{@gandalfInRohan=1}}\n{if fellowship=3:{if merryPippinFellFromMountain=0:{@merryPippinInRohan=1}}}</p>\n<p>Weeks pass as you and Sam wander the hills of Emyn Muil towards the Black Gate of Mordor. It&#39;s a long, arduous journey over rough terrain, but you&#39;re doing pretty well so far.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue237\" role=\"link\" tabindex=\"0\">One night, while camping out under the stars, you&#39;re both awakened by an unexpected visitor.</a></p>",
		'passages': {
		},
	},
	'_continue237': {
		'text': "<p>You eyes open to see a wide-eyed, half-starved creature in a loincloth reaching for your Ring. Before you can react, Sam hits the creature upside the head with his frying pan.</p>\n<p>A brief scuffle erupts between the two, but Sam ultimately subdues the creature and ties it up.</p>\n<p>You realize the creature is Gollum, the one whom Bilbo stole the Ring from all those years ago. He&#39;s been following you the whole way here.</p>\n<p>&quot;We should <a class=\"squiffy-link link-section\" data-section=\"put the wretch out of his misery\" role=\"link\" tabindex=\"0\">put the wretch out of his misery</a>,&quot; Sam says.</p>\n<p>Gollum begs, &quot;No, <a class=\"squiffy-link link-section\" data-section=\"please spares us\" role=\"link\" tabindex=\"0\">please spares us</a>! We will serve the Precious! We will helps you, we swears!&quot;</p>",
		'passages': {
		},
	},
	'put the wretch out of his misery': {
		'text': "<p>You tell Sam to put an end to Gollum now, certain that you can&#39;t trust the ragged creature. Sam immediately murders Gollum without hesitation, in a way very unbecoming of a gardener.</p>\n<p>He takes back his rope and casually kicks Gollum&#39;s limp corpse off a nearby cliff.</p>\n<p>&quot;There,&quot; he says. &quot;That ugliness has been sorted. Shall we go?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You carry on towards the Dead Marshes.\" role=\"link\" tabindex=\"0\">You carry on towards the Dead Marshes.</a></p>",
		'attributes': ["gollumDead = 1"],
		'passages': {
		},
	},
	'please spares us': {
		'text': "<p>You feel pity for poor Gollum and ask Sam to release him. Gollum promises to serve you and the &#39;Precious&#39; on your journey, though he&#39;s not keen on returning it to the Dark Lord&#39;s realm.</p>\n<p>He requests you call him &#39;Smeagol&#39;, though you still end up calling him Gollum.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You carry on towards the Dead Marshes.\" role=\"link\" tabindex=\"0\">You carry on towards the Dead Marshes.</a></p>",
		'passages': {
		},
	},
	'You carry on towards the Dead Marshes.': {
		'text': "<p>{if gaveFakeName=1:{if eaglesComing=0:{@Encounter=1}}}\n{if gaveFakeName=1:{if eaglesComing=1:{@Encounter=2}}}\n{if gaveFakeName=0:{if eaglesComing=0:{@Encounter=3}}}\n{if gaveFakeName=0:{if eaglesComing=1:{@Encounter=4}}}</p>\n<p>{if gaveFakeName=0:{if witchKingDanceOff=0:As you journey, you hear a screech in the skies above. Taking cover, you see the WITCH KING pass by on his winged steed, still hunting you.}}</p>\n<p>{if gaveFakeName=1:As you journey, you hear a screech in the skies above. Taking cover, you see a new Black Rider soaring past overhead on a winged beast. It is the WITCH KING.}</p>\n<p>{if eaglesComing=1:Then you hear a second screech. At first you feel hopeful, because you see a flock of eagles coming. But then you spy the lead eagle is the same scarred one who saved you back at Caradhras.}</p>\n<p>{if eaglesComing=1:The eagles and the Witch King clash in mid-air. The Witch King is overwhelmed and flies away.}</p>\n<p>{if eaglesComing=1:Through the Ring&#39;s powers, you hear an eagle speak to the others, &quot;Find the hobbits! Take the Ring for ourselves! Don&#39;t let it pass into Mordor!&quot;}</p>\n<p>{if eaglesComing=1:As they fly away, Sam comments, &quot;They must have the seen the Ring on you back on Caradhras. Gandalf was right about that accursed thing; even the eagles can&#39;t resist its power. Just another thing to worry about, I guess.&quot;}</p>\n<p>{if Encounter=1:The Witch King circles the area, but does not see you. He flies away towards Mordor, leaving you and Sam shaken.}</p>\n<p>{if Encounter=3:The Witch King circles the area, but does not see you. He flies away towards Mordor, leaving you and Sam more shaken than his last appearance. {if pippinKilledByWitchKing=1:In your mind, you can still hear Pippin&#39;s screams as the beast gobbled him up.}}</p>\n<p>Once it&#39;s safe to proceed, <a class=\"squiffy-link link-section\" data-section=\"you continue into the marshes\" role=\"link\" tabindex=\"0\">you continue into the marshes</a>.</p>",
		'passages': {
		},
	},
	'you continue into the marshes': {
		'text': "<p>The weight of the Ring gets heavier, the closer you get to Mordor. You travel across a bleak swamp filled with undecomposed corpses. Little flashes of swamp gas flare up across the water.</p>\n<p>{if gollumDead=0:Gollum leads the way and shouts, &quot;Don&#39;t follow the lights!&quot;}</p>\n<p>As you shuffle through the swamp, you started petting your Ring again. You wonder if you should <a class=\"squiffy-link link-section\" data-section=\"pet it gently\" role=\"link\" tabindex=\"0\">pet it gently</a> or <a class=\"squiffy-link link-section\" data-section=\"pet it fondly\" role=\"link\" tabindex=\"0\">pet it fondly</a>. This is a very important choice you must make.</p>",
		'passages': {
		},
	},
	'pet it gently': {
		'text': "<p>The Ring likes that. You like that. It almost makes you forget you&#39;re in a horrible corpse-filled swamp.</p>\n<p>In your haze, <a class=\"squiffy-link link-section\" data-section=\"you stupidly fall into the water.\" role=\"link\" tabindex=\"0\">you stupidly fall into the water.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'pet it fondly': {
		'text': "<p>The Ring likes that. You like that. It almost makes you forget you&#39;re in a horrible corpse-filled swamp.</p>\n<p>In your haze, <a class=\"squiffy-link link-section\" data-section=\"you stupidly fall into the water.\" role=\"link\" tabindex=\"0\">you stupidly fall into the water.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'you stupidly fall into the water.': {
		'text': "<p>{if gollumDead=1:Sam quickly fishes you out and helps you across the swamp. Your brain isn&#39;t all there right now.}</p>\n<p>{if gollumDead=0:Gollum quickly fishes you out and helps you across the swamp. Your brain isn&#39;t all there right now.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue238\" role=\"link\" tabindex=\"0\">You eventually arrive at the Black Gate.</a></p>",
		'passages': {
		},
	},
	'_continue238': {
		'text': "<p>The entrance to Mordor is an impressive sight. A giant metal gate lies between two unclimbable mountain passes.</p>\n<p>Sam&#39;s certain you can <a class=\"squiffy-link link-section\" data-section=\"rush the gate the next time it opens\" role=\"link\" tabindex=\"0\">rush the gate the next time it opens</a>. {if gollumDead=0:Gollum insists you <a class=\"squiffy-link link-section\" data-section=\"follow him through another path\" role=\"link\" tabindex=\"0\">follow him through another path</a> around the gate.}{if gollumDead=1:But maybe you should <a class=\"squiffy-link link-section\" data-section=\"find a different way around it instead\" role=\"link\" tabindex=\"0\">find a different way around it instead</a>.}</p>",
		'passages': {
		},
	},
	'find a different way around it instead': {
		'text': "<p>You and Sam spend hours searching the base of mountains and getting lost. It&#39;s a long, tiresome hike and your feet are aching. Soon, you wander into a thick, brushy area where you are set upon by a scouting team of Gondor soldiers. These are the soldiers whom Boromir once spoke of.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are taken prisoner and brought to an underground Gondorian outpost.\" role=\"link\" tabindex=\"0\">You are taken prisoner and brought to an underground Gondorian outpost.</a></p>",
		'passages': {
		},
	},
	'follow him through another path': {
		'text': "<p>Gollum leads you south towards the stronghold of Minas Morgul. Doing so brings you near the city of Osgiliath where you witness the forces of Mordor battling Gondor soldiers. These are the soldiers whom Boromir spoke of.</p>\n<p>You try to avoid the conflict, but a group of rangers set upon you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are taken prisoner and brought to an underground Gondorian outpost.\" role=\"link\" tabindex=\"0\">You are taken prisoner and brought to an underground Gondorian outpost.</a></p>",
		'passages': {
		},
	},
	'rush the gate the next time it opens': {
		'text': "<p>You tell Sam you&#39;ll take a chance with the Black Gate. {if gollumDead=0:Gollum begs, &quot;Please! No! We must takes the other path! They&#39;ll finds us, they will!&quot;}</p>\n<p>But as the gate opens to welcome an armament of Sauron&#39;s troops, you and Sam hurry along the cliff walls, sticking to cover. The troops don&#39;t see you past their helmets, or hear you over their armour. Your elven robes help camouflage you from the men on the wall. {if gollumDead=0:Gollum whimpers, terrified of being spotted.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue239\" role=\"link\" tabindex=\"0\">But you make it through the gates in time.</a></p>",
		'passages': {
		},
	},
	'_continue239': {
		'text': "<p>The gates slam shut, and you look upon a vast military encampment in the shadow of Mt. Doom. Overlooking the camp, you see a great Dark Tower with a flaming eye perched at its spire. It is the tower of Barad-dûr, and the eye is that of the Dark Lord Sauron.</p>\n<p>The Ring feels heavier than ever. As you look upon the flaming eye, the Ring feels searing hot around your neck. You start to go limp.</p>\n<p>{if gollumDead=0:&quot;We must leave now,&quot; Gollum cries, &quot;Leave now!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue240\" role=\"link\" tabindex=\"0\">The eye of Sauron looks upon you.</a></p>",
		'passages': {
		},
	},
	'_continue240': {
		'text': "<p>In moments, every soldier in the area looks your way. You are quickly surrounded. Emerging from the rocks and walls, orcs, goblins, men and other wretched beings have their swords and spears at your throat. </p>\n<p>&quot;Get back!&quot; Sam shouts, waving his shortsword, but he is bludgeoned from behind and knocked out. {if gollumDead=0:Gollum ducks and covers, begging for mercy.}</p>\n<p>You turn to face a giant man in black armour, with a wide, fanged mouth uncovered from his face mask. He lifts Sam up by the collar and turns to address you.</p>\n<p>&quot;The Dark Lord would like to have a word with you,&quot; the Mouth of Sauron speaks.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue241\" role=\"link\" tabindex=\"0\">You are captured and taken to the Dark Tower.</a></p>",
		'passages': {
		},
	},
	'_continue241': {
		'text': "<p>It is not a pleasant trip. The orcs drag you and Sam across the fields, your hands bound in nasty rope. The Mouth of Sauron instructs the soldiers not to relieve you of your weapons or armour, and doesn&#39;t even mention the Ring. It knows Sauron wants to deal with you personally.</p>\n<p>{if gollumDead=0:Gollum comes willingly. He&#39;s faced Sauron&#39;s soldiers before, and knows better than to put up a fight.}</p>\n<p>Sam wakes up. &quot;This is the end, isn&#39;t it, Mr. Frodo? <a class=\"squiffy-link link-section\" data-section=\"Tell me we have a chance\" role=\"link\" tabindex=\"0\">Tell me we have a chance</a>. Or at least <a class=\"squiffy-link link-section\" data-section=\"tell me we'll die quickly\" role=\"link\" tabindex=\"0\">tell me we&#39;ll die quickly</a>.&quot;</p>",
		'passages': {
		},
	},
	'Tell me we have a chance': {
		'text': "<p>You tell Sam everything will be okay as the forces of evil drag you towards the flaming eye of doom, death, and destruction.</p>\n<p>He is not assured.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ascend into Sauron's tower.\" role=\"link\" tabindex=\"0\">You ascend into Sauron&#39;s tower.</a></p>",
		'passages': {
		},
	},
	'tell me we\'ll die quickly': {
		'text': "<p>You tell Sam that Sauron&#39;s people will end your lives quickly, painlessly, and humanely. There will be no torture or suffering, and you&#39;ll be granted proper, respectful funerals.</p>\n<p>He is not assured.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ascend into Sauron's tower.\" role=\"link\" tabindex=\"0\">You ascend into Sauron&#39;s tower.</a></p>",
		'passages': {
		},
	},
	'You ascend into Sauron\'s tower.': {
		'text': "<p>Barad-dûr is quite nice on the inside.</p>\n<p>Silk curtains, stained-glass windows, and lovely candelabras adorn the walls. Even the paintings are tasteful and lovely. It&#39;s not the horrid, stench-filled spire of horror you expected. In fact, it&#39;s cleaner than Bag End.</p>\n<p>{if gollumDead=0:Even Gollum stops sobbing long enough to admire it. This is a much nicer place than the dungeon he was tortured in.}</p>\n<p>The orcs lead you up a long, spiral staircase until you finally reach the top floor of the tower. You find yourselves looking upon the great flaming eye in person. Its presence is quite cool, and not blazingly hot as you would imagine.</p>\n<p>&quot;Lord Sauron, the halfling has come willingly to your land,&quot; the Mouth speaks.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue242\" role=\"link\" tabindex=\"0\">Out of the eye, a body emerges.</a></p>",
		'passages': {
		},
	},
	'_continue242': {
		'text': "<p>A glowing entity of light walks down through the air towards you. You are stunned by its regal beauty, although Sam appears to be still looking at the Eye and cannot see the forthcoming entity. The entity takes a ghost-like form and you alone see the non-corporeal embodiment of Sauron himself.</p>\n<p>He is a beautiful man, with long flowing hair and a compassionate face. You can&#39;t see the cruelty in his eyes that he is known for.</p>\n<p>&quot;Curious... that so small a thing could carry so great a power,&quot; he speaks. &quot;It was you who bested my Nazgul. You, who evaded Saruman and his Uruk-hai. {if witchKingDanceOff=1:You, who killed the Witch King of Angmar... with a song.} And yet all our efforts were in vain... for you deliver yourself directly to me.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue243\" role=\"link\" tabindex=\"0\">Sauron speaks to his emissary.</a></p>",
		'passages': {
		},
	},
	'_continue243': {
		'text': "<p>&quot;Please see to it that our guests are well-fed and bathed. I&#39;d very much like to see... &#39;Frodo&#39;... for dinner.&quot;</p>\n<p>Sauron vanishes from your sight.</p>\n<p>&quot;<a class=\"squiffy-link link-section\" data-section=\"Don't listen to it\" role=\"link\" tabindex=\"0\">Don&#39;t listen to it</a>,&quot; Sam insists. &quot;We need to get out of here.&quot;</p>\n<p>But you are hungry, and your Ring suddenly feels lighter. Perhaps it wouldn&#39;t hurt to <a class=\"squiffy-link link-section\" data-section=\"attend dinner\" role=\"link\" tabindex=\"0\">attend dinner</a>.</p>",
		'passages': {
		},
	},
	'attend dinner': {
		'text': "<p>You insist you at least try to get food in your bellies. You are led to a lavish dining hall where you sit as guests of honour at a table. The orcs here are unusually friendly. and not so ugly when they aren&#39;t snarling at you.</p>\n<p>Dinner is roast pork, glazed in honey. There are various sides of greens, local bread, and a lovely pudding bowl. The food is surprisingly delicious. It all seems too good to be true. {if gollumDead=0:They&#39;re even kind enough to bring Gollum a raw fish to snack on.}</p>\n<p>Sam doesn&#39;t touch any of it. He&#39;s still wary of all the orcs.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue244\" role=\"link\" tabindex=\"0\">Sauron appears at the head of the table.</a></p>",
		'attributes': ["hadDinnerInMordor = 1","precious+=1"],
		'passages': {
		},
	},
	'_continue244': {
		'text': "<p>Sam still doesn&#39;t see him.</p>\n<p>Sauron speaks, &quot;Your friend should eat, really. Feel free to take some bread to your quarters, should he get hungry later. And don&#39;t mind the orcs; you&#39;re our guests and they&#39;re here for your safety, not your imprisonment.&quot;</p>\n<p>&quot;You see, my good will doesn&#39;t extend beyond this tower as much as I would like. Mordor was once a beautiful, green land, but it was ravished for its resources, and its people were left to fall back on savage ways. I tried to care for them, but the alliance of men, elves and dwarves wouldn&#39;t allow it.&quot;</p>\n<p>&quot;When they fashioned the rings of powers, I had the One Ring forged as a counter-weight. Something that would give my people hope. And now you&#39;ve returned that hope to us.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue245\" role=\"link\" tabindex=\"0\">He gestures to a throne at the end of the room.</a></p>",
		'passages': {
		},
	},
	'_continue245': {
		'text': "<p>&quot;Mordor needs a king,&quot; Sauron says, &quot;and my spirit cannot take the throne. But you, Frodo, have endured so much. You&#39;ve proven yourself worthy to carry our Ring. With it, you could make Mordor green again, and restore it to peace.&quot;</p>\n<p>One of the sentry orcs smiles hopefully at you. It is a kind, warm smile that almost breaks your heart.</p>\n<p>&quot;What are you staring at?&quot; Sam asks. &quot;Think, Mr. Frodo! We must <a class=\"squiffy-link link-section\" data-section=\"escape this tower\" role=\"link\" tabindex=\"0\">escape this tower</a>!&quot;</p>\n<p>&quot;Your friend is loyal and well-meaning,&quot; Sauron says. &quot;He would be an excellent counselor. You should <a class=\"squiffy-link link-section\" data-section=\"tell him of my proposal\" role=\"link\" tabindex=\"0\">tell him of my proposal</a>.&quot;</p>",
		'passages': {
		},
	},
	'tell him of my proposal': {
		'text': "<p>You tell Sam of Sauron&#39;s offer to give you the throne and save Mordor. You insist you could end the war from this throne.</p>\n<p>&quot;Are you mad?&quot; Sam asks. &quot;The Ring&#39;s forces have hounded us since the Shire! {if merryDead=1: They killed Merry!}{if pippinDead=1: They killed Pippin!} {if bilboDead=1: Your Uncle Bilbo was killed by its madness!}{if gandalfDead=1: And Gandalf fell in Moria, counting on us to destroy it!} We abandoned the Fellowship to <a class=\"squiffy-link link-section\" data-section=\"complete the mission\" role=\"link\" tabindex=\"0\">complete the mission</a>, and now you&#39;re planning to <a class=\"squiffy-link link-section\" data-section=\"join the forces of darkness?\" role=\"link\" tabindex=\"0\">join the forces of darkness?</a>&quot;</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'complete the mission': {
		'text': "<p>You apologize to Sam. You didn&#39;t know what you were thinking. Yes, you must most certainly <a class=\"squiffy-link link-section\" data-section=\"escape this tower\" role=\"link\" tabindex=\"0\">escape this tower</a>.</p>",
		'passages': {
		},
	},
	'join the forces of darkness?': {
		'text': "<p>Would it be the worst thing to use the Ring at this point? Here, at the height of Mordor&#39;s power, you could wield it in a way no man, elf, or dwarf could.</p>\n<p>&quot;Please rest before deciding,&quot; Sauron says, &quot;A decision like this is not made lightly.&quot;</p>\n<p>After dinner, <a class=\"squiffy-link link-section\" data-section=\"you are escorted to your bedrooms\" role=\"link\" tabindex=\"0\">you are escorted to your bedrooms</a>.</p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'Don\'t listen to it': {
		'text': "<p>Your loyalty to Sam wins. You decline Sauron&#39;s offer for dinner.</p>\n<p>Sauron sighs, &quot;Then at least let us give you rest before you leave.&quot;</p>\n<p>He disappears and <a class=\"squiffy-link link-section\" data-section=\"you are escorted to your bedrooms\" role=\"link\" tabindex=\"0\">you are escorted to your bedrooms</a>.</p>",
		'passages': {
		},
	},
	'escape this tower': {
		'text': "<p>Your resolve against the Ring&#39;s will is stronger now.</p>\n<p>Sauron senses your conflict. After dinner, <a class=\"squiffy-link link-section\" data-section=\"you are escorted to your bedrooms\" role=\"link\" tabindex=\"0\">you are escorted to your bedrooms</a>.</p>",
		'passages': {
		},
	},
	'you are escorted to your bedrooms': {
		'text': "<p>Mad as it seems, the living quarters here are more accommodating than those in Rivendell. The rooms are cozy and well-heated, with comfortable beds and fresh towels. There&#39;s even mints on the pillow.</p>\n<p>{if gollumDead=0:Gollum stops by your room to show off the lovely silk pajamas Sauron&#39;s men left him. They&#39;re a little over-sized, but he vastly prefers them to his loincloth.}</p>\n<p>Sam stays in his room, contemplating how to escape.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue246\" role=\"link\" tabindex=\"0\">That night, you have a dream.</a></p>",
		'passages': {
		},
	},
	'_continue246': {
		'text': "<p>You see the Fellowship on the walls of a great mountain fortress. They battle a horde of orcs, ten thousand strong. The battle is furious and bloody, and you can see Aragorn, Gimli, and Legolas in the thick of it. {if boromirDead=0:You even spot Boromir and Gandalf the Grey battling from the rampants.}</p>\n<p>&quot;Your friends fight for the future of Middle-Earth,&quot; you hear Sauron say. &quot;Saruman&#39;s forces may seem overwhelming, but they will not win this battle. Your friends will save Rohan and then move on to defending Gondor.&quot;</p>\n<p>{if gandalfWhite=1:You see a white wizard leading a charge of horses into the battle. It&#39;s Gandalf, alive and well!}</p>\n<p>&quot;But they will keep fighting to no end. Once they reach Mordor, they will be slaughtered... unless Mordor has a king to broker a peace.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue247\" role=\"link\" tabindex=\"0\">Sam enters your room with several blankets tied together.</a></p>",
		'passages': {
		},
	},
	'_continue247': {
		'text': "<p>&quot;Come, Mister Frodo, let us <a class=\"squiffy-link link-section\" data-section=\"escape out the window\" role=\"link\" tabindex=\"0\">escape out the window</a>!&quot; Sam says. &quot;I&#39;ve made a rope out of blankets!&quot;</p>\n<p>{if hadDinnerInMordor=0:But your head feels heavy from that dream. Something tells you that you should <a class=\"squiffy-link link-section\" data-section=\"wander the halls and get some air\" role=\"link\" tabindex=\"0\">wander the halls and get some air</a>.}</p>\n<p>{if hadDinnerInMordor=1:You&#39;re at a crossroads now. It&#39;s either escape... or <a class=\"squiffy-link link-section\" data-section=\"stay and become king\" role=\"link\" tabindex=\"0\">stay and become king</a>.}</p>",
		'passages': {
		},
	},
	'stay and become king': {
		'text': "<p>You tell Sam there&#39;s something you must do.</p>\n<p>You return to the throne room. Many guards appear to have been waiting for you. You take the Ring from the chain around your neck and sit in the throne. Nobody tries to stop you.</p>\n<p>&quot;Mister Frodo, wait, stop!&quot; Sam begs.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue248\" role=\"link\" tabindex=\"0\">You wear the Ring.</a></p>",
		'attributes': ["precious+=1","precious+=1"],
		'passages': {
		},
	},
	'_continue248': {
		'text': "<p>Sauron appears before you.</p>\n<p>{if precious&gt;9:<a class=\"squiffy-link link-section\" data-section=\"And he bows.\" role=\"link\" tabindex=\"0\">And he bows.</a>}</p>\n<p>{if precious&lt;10:<a class=\"squiffy-link link-section\" data-section=\"And nothing happens.\" role=\"link\" tabindex=\"0\">And nothing happens.</a>}</p>",
		'passages': {
		},
	},
	'And he bows.': {
		'text': "<p>Sam runs into the room to see you stand from the throne. The Ring&#39;s power no longer turns you invisible.</p>\n<p>You tell Sam you&#39;ve no more business at this tower and would like to depart immediately for Mt. Doom.</p>\n<p>&quot;Oh... good,&quot; Sam sighs, &quot;For a second, I thought something terrible just happened.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Sam escape the dark tower.\" role=\"link\" tabindex=\"0\">You and Sam escape the dark tower.</a></p>",
		'attributes': ["possessedBySauron = 1"],
		'passages': {
		},
	},
	'escape out the window': {
		'text': "<p>Moments later, you find yourself climbing out the window.</p>\n<p>&quot;It&#39;s just a few stories,&quot; Sam says. &quot;We&#39;ll fall the rest of the way and be at Mt. Doom within the hour.&quot;</p>\n<p>You fall from the tower and land in a hay stack. Your Ring grows heavier once again.</p>\n<p>{if gollumDead=0:&quot;Wait!&quot; Gollum screams, clambering down the walls in his silk pajamas, &quot;Don&#39;t forget poor Smeagol!&quot;}</p>\n<p>As you rush away from the tower walls, the flaming eye gazes upon you.</p>\n<p>You hear Sauron speak, &quot;I&#39;ll grant you a head-start and distract the orcs, Frodo, but be warned... I am so disappointed in you.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Sam escape the dark tower.\" role=\"link\" tabindex=\"0\">You and Sam escape the dark tower.</a></p>",
		'passages': {
		},
	},
	'wander the halls and get some air': {
		'text': "<p>You are allowed to freely wander the halls of Barad-dûr. The guards respect your presence and regard you kindly. They seem much less hostile than the orcs you&#39;ve encountered so far. Many seem better-groomed and, dare you say, almost attractive.</p>\n<p>As you wander, you gaze upon paintings and tapestries that adorn the halls. They tell the story of Mordor, a thousand years past, and how it was once a beautiful land, rich in culture and resources. Even the orcs appeared to be like elves at one point. They lived in golden palaces, had plentiful families, and revelled in their arts and crafts.</p>\n<p>&quot;That was before the war,&quot; Sauron says, his spirit manifesting next to you. &quot;Then the men, the elves, and the dwarves came with their rings of power. They ravaged our land and forced us into savagery. The One Ring was forged to balance the scales, but it was not enough to defend ourselves. If Mordor is to survive, the will of its king must extend beyond these walls.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue249\" role=\"link\" tabindex=\"0\">You arrive at a throne room.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'_continue249': {
		'text': "<p>Sauron gestures towards a majestic black throne carved from obsidian.</p>\n<p>&quot;Mordor needs a new king,&quot; he says. &quot;Someone worthy enough to end its hostility and make peace with the other lands. You, Frodo, have endured so much. Under your rule, Mordor would grow green again.&quot;</p>\n<p>As you return to your bedroom, you reconsider Sam&#39;s proposal to <a class=\"squiffy-link link-section\" data-section=\"escape out the window\" role=\"link\" tabindex=\"0\">escape out the window</a>.</p>\n<p>Sauron fades into the air and pleads, &quot;Please, abandon your quest; <a class=\"squiffy-link link-section\" data-section=\"stay and become king\" role=\"link\" tabindex=\"0\">stay and become king</a>.&quot;</p>\n<p>You see Sam standing outside your bedroom.</p>",
		'passages': {
		},
	},
	'And nothing happens.': {
		'text': "<p>Sauron seems surprised.</p>\n<p>&quot;How curious,&quot; he says. &quot;Is there no bond between you and the Ring? Have you not been swayed by its power?&quot;</p>\n<p>You&#39;re not sure what Sauron was expecting.</p>\n<p>His grimace grows firm, &quot;The Ring hasn&#39;t chosen you after all. It couldn&#39;t. Just as it held no power in my final days, it holds no power now. The Ring has failed. I have failed.&quot;</p>\n<p>The orcs begins to grow restless. They whisper concerningly among themselves.</p>\n<p>Sauron begins to vanish. &quot;My will is fading. You will soon no longer be safe here. Take your company and flee to the mountain. Cast the Ring in before its emptiness tears Mordor apart.&quot;</p>\n<p>Sauron disappears. The orcs seem less kindly all of a sudden, as if a veil were lifted from their eyes. Sam runs into the room{if gollumDead=0: with Gollum, who is groggy and restless}. You tell him of what transpired and that you must leave immediately. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue250\" role=\"link\" tabindex=\"0\">You recollect your equipment and flee the tower.</a></p>",
		'passages': {
		},
	},
	'_continue250': {
		'text': "<p>You hurry away towards Mt. Doom. {if gollumDead=0:Gollum follows, unsure as to why you can&#39;t stay.}</p>\n<p>&quot;What was that all about?&quot; Sam asks. &quot;Did you agree to be king?&quot;</p>\n<p>You tell Sam the Ring no longer holds you. You&#39;ve successfully resisted it enough to thwart whatever dark magicks were at work inside the tower. All that&#39;s left to do now is destroy it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Sam escape the dark tower.\" role=\"link\" tabindex=\"0\">You and Sam escape the dark tower.</a></p>",
		'passages': {
		},
	},
	'You and Sam escape the dark tower.': {
		'text': "<p>You march briskly through the wastes, past camps and orc brigades towards Mt. Doom in the distance. {if possessedBySauron=0:The orcs already sense there&#39;s something wrong with you wandering freely, but they second-guess themselves thanks to what&#39;s left of Sauron&#39;s fading influence. You don&#39;t know how long that&#39;ll last.}{if possessedBySauron=1:Despite the orcs granting you full passage, Sam seems to be having a hard time keeping up. Your energy has tripled since leaving the tower.}</p>\n<p>{if possessedBySauron=0:Looking back, Sam sees the flaming eye of Sauron watching you intently. It appears more agitated than before, as if it really wants you to hurry past these orcs.}{if possessedBySauron=1:Looking back, Sam notices there&#39;s no longer a flaming eye atop the tower anymore. Somehow, that seems scarier for some reason.}</p>\n<p>{if gollumDead=0: Gollum hobbles behind in his pajamas, asking &quot;Why do we have to leave? Smeagol likes it now!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue251\" role=\"link\" tabindex=\"0\">You approach the base of the mountain.</a></p>",
		'passages': {
		},
	},
	'_continue251': {
		'text': "<p>{if possessedBySauron=0:The orcs have been slowly following you these past few miles. Gathering up their courage to attack. The veil of Sauron&#39;s will is lifting and they&#39;re now seeing you for the intruders you are.}</p>\n<p>{if possessedBySauron=1:Sam grows concerned about your perfectly normal behaviour. He begs to know what happened to you in the throne room. He doesn&#39;t understand that you&#39;re no longer the meek hobbit who left the Shire. You&#39;ve become something more.}</p>\n<p>{if possessedBySauron=0:{if gollumDead=0:<a class=\"squiffy-link link-section\" data-section=\"Gollum is getting antsy.\" role=\"link\" tabindex=\"0\">Gollum is getting antsy.</a>}}</p>\n<p>{if possessedBySauron=1:{if gollumDead=0:<a class=\"squiffy-link link-section\" data-section=\"Gollum starts to clue in that something is wrong.\" role=\"link\" tabindex=\"0\">Gollum starts to clue in that something is wrong.</a>}}</p>\n<p>{if possessedBySauron=0:{if gollumDead=1:<a class=\"squiffy-link link-section\" data-section=\"The orcs advance on you.\" role=\"link\" tabindex=\"0\">The orcs advance on you.</a>}}</p>\n<p>{if possessedBySauron=1:{if gollumDead=1:<a class=\"squiffy-link link-section\" data-section=\"You march up the side of Mt. Doom.\" role=\"link\" tabindex=\"0\">You march up the side of Mt. Doom.</a>}}</p>",
		'passages': {
		},
	},
	'Gollum is getting antsy.': {
		'text': "<p>He squeals, &quot;What are we doing here with the Precious? We mustn&#39;t bring it here! They&#39;ll takes it from us!&quot;</p>\n<p>There&#39;s no sense hiding it now. You tell Gollum you&#39;ve come to destroy the Ring. He doesn&#39;t grasp the idea of destroying the Precious and begins to panic.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue252\" role=\"link\" tabindex=\"0\">Spying the Ring on the chain around your neck, he acts out.</a></p>",
		'passages': {
		},
	},
	'_continue252': {
		'text': "<p>&quot;We must saves the Precious!&quot; he cries, pouncing on you. </p>\n<p>Sam is quick to pull him off you, but gets dragged down to the ground. The three of you roll on the ground fighting while the orcs watch.</p>\n<p>&quot;Fine, take it!&quot; Sam screams, ripping the chain from your neck and throwing it away. Gollum races after it and slides down some rocks, landing among a troop of orcs.</p>\n<p>He discovers Sam threw the chain, but the Ring is no longer attached.</p>\n<p>&quot;Stupid fat hobbit tricked us!&quot; Gollum shrieks.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue253\" role=\"link\" tabindex=\"0\">The orcs fall upon Gollum.</a></p>",
		'passages': {
		},
	},
	'_continue253': {
		'text': "<p>While the orcs attack Gollum, Sam takes you by the arm and you race up the mountain. You now have a clear shot at destroying the Ring.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass through a cave into the heart of Mt. Doom.\" role=\"link\" tabindex=\"0\">You pass through a cave into the heart of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You pass through a cave into the heart of Mt. Doom.': {
		'text': "<p>You stand at the edge of a fiery precipice. A river of lava flows below.</p>\n<p>&quot;Throw it down!&quot; Sam calls, watching the exit. The orcs will be upon you any moment.</p>\n<p>The Ring no longer has power over you, so you don&#39;t hear its call. You should probably <a class=\"squiffy-link link-section\" data-section=\"just throw it in the lava\" role=\"link\" tabindex=\"0\">just throw it in the lava</a>, but it couldn&#39;t hurt to <a class=\"squiffy-link link-section\" data-section=\"slip it on one more time\" role=\"link\" tabindex=\"0\">slip it on one more time</a></p>",
		'passages': {
		},
	},
	'The orcs advance on you.': {
		'text': "<p>Sam won&#39;t have any of this. He unsheathes his sword and goes to town on the orcs.</p>\n<p>&quot;Stay away from him!&quot; he shouts, cutting down orc after orc. The orcs try to defend themselves, but they&#39;ve never seen fury like Sam&#39;s before. You watch in amazement as Sam rips through twenty of them. The rest begin to retreat, as they&#39;ve suddenly realized they&#39;re no match for an angry hobbit.</p>\n<p>{if eaglesComing=1:As the orcs retreat, you see the eagles fast approaching. They&#39;ve caught up with you.}</p>\n<p>&quot;It&#39;s time to finish this,&quot; a blood-drenched Sam says as he pulls you up the mountain.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You pass through a cave into the heart of Mt. Doom.\" role=\"link\" tabindex=\"0\">You pass through a cave into the heart of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'slip it on one more time': {
		'text': "<p>You sneer at Sam and tell him the Ring is yours.</p>\n<p>Placing it on your finger, you turn invisible. Sam is horrified.</p>\n<p>And then you reappear as you take it off. You tell Sam you&#39;re just kidding.</p>\n<p>&quot;That&#39;s not funny,&quot; Sam says. &quot;Please, <a class=\"squiffy-link link-section\" data-section=\"just throw it in the lava\" role=\"link\" tabindex=\"0\">just throw it in the lava</a> already.&quot;</p>",
		'passages': {
		},
	},
	'just throw it in the lava': {
		'text': "<p>You toss the Ring into the fires.</p>\n<p>It melts. </p>\n<p>The Ring is now destroyed. Good job!</p>\n<p>The mountain erupts and your cave begins to collapse.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Sam escape from Mt. Doom.\" role=\"link\" tabindex=\"0\">You and Sam escape from Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'Gollum starts to clue in that something is wrong.': {
		'text': "<p>He suddenly fathoms the unfathomable.</p>\n<p>&quot;The Precious!&quot; he exclaims, &quot;We cannots be here! The fires will hurt the Precious!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue254\" role=\"link\" tabindex=\"0\">You&#39;ve had enough of Gollum&#39;s sniveling.</a></p>",
		'passages': {
		},
	},
	'_continue254': {
		'text': "<p>{if hasSwordSting=1:With a swift strike, you drive Sting through Gollum&#39;s chest and kick him down some rocks.}</p>\n<p>{if hasSwordSting=0:With a powerful roundhouse kick, you strike Gollum in the head, breaking his neck. Gollum rolls down some rocks and lays dead at the foot of Mt. Doom.}</p>\n<p>Sam watches in horror as the life you once spared extinguishes without a plea for mercy.</p>\n<p>&quot;Mr. Frodo! What did you DO?&quot;</p>\n<p>You tell Sam that Gollum would have compromised the mission, and you&#39;re too close to the finish line now. Sam can&#39;t accept what you just did. He looks at you with condemnation, but says nothing. He looks down at Gollum&#39;s body, adorned in beautiful silk pajamas, and knows you&#39;re not Frodo.</p>\n<p>{if eaglesComing=1:In the distance, you hear eagles screeching. You know they&#39;re coming for the Ring and you haven&#39;t much time.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You march up the side of Mt. Doom.\" role=\"link\" tabindex=\"0\">You march up the side of Mt. Doom.</a></p>",
		'attributes': ["gollumDead = 1","gollumKilledByYou = 1"],
		'passages': {
		},
	},
	'You march up the side of Mt. Doom.': {
		'text': "<p>You order Sam to follow faster. You arrive at a gap in the mountain and enter a long hallway into the heart of Mt. Doom. You find a precipice overlooking a pit of lava.</p>\n<p>&quot;This it it!&quot; Sam says, &quot;Throw it in!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue255\" role=\"link\" tabindex=\"0\">You toss the Ring in without hesitation.</a></p>",
		'passages': {
		},
	},
	'_continue255': {
		'text': "<p>Sam expects more to happen as the One Ring melts into the volcano&#39;s core. He expects tremors. He expects Middle-Earth to open up and swallow Mordor. He expects to die with here with his beloved Frodo.</p>\n<p>You turn around and tell Sam it is done. The Ring is gone and will no longer be a problem.</p>\n<p>Now, you wonder, is it time to <a class=\"squiffy-link link-section\" data-section=\"head back to your throne\" role=\"link\" tabindex=\"0\">head back to your throne</a> or <a class=\"squiffy-link link-section\" data-section=\"forge a new Ring\" role=\"link\" tabindex=\"0\">forge a new Ring</a>?</p>",
		'passages': {
		},
	},
	'head back to your throne': {
		'text': "<p>&quot;What do you mean YOUR throne?&quot; Sam asks.</p>\n<p>You tell Sam the Ring was holding you back. Now you&#39;re free of its stain. Free to become the king Mordor deserves. Free to spread your will across Middle-Earth and correct the mistakes of its past. From your throne, you could fix all of Sauron&#39;s mistakes. You could make Mordor rise again.</p>\n<p>Your feet ache and you wonder if Sam is up to carrying you back.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Sam sees you for what you are.\" role=\"link\" tabindex=\"0\">Sam sees you for what you are.</a></p>",
		'passages': {
		},
	},
	'forge a new Ring': {
		'text': "<p>&quot;What do you mean a NEW RING?&quot; Sam asks.</p>\n<p>You tell Sam the old Ring was flawed. It didn&#39;t stop Sauron&#39;s armies in the past, and it certainly took its time coming home. The One Ring was only tainted with Sauron&#39;s will, not enriched. But a new Ring, made fresh, could be a thousand times more devastating to your enemies.</p>\n<p>You wonder where in this mountain you can find some crafting items.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Sam sees you for what you are.\" role=\"link\" tabindex=\"0\">Sam sees you for what you are.</a></p>",
		'passages': {
		},
	},
	'Sam sees you for what you are.': {
		'text': "<p>He snatches something from your travel bag.</p>\n<p>Before you can stop him, a blinding light catches you off-guard. You stumble backwards towards the edge of the cliff.</p>\n<p>Sam holds the Light of Lothlorien towards you. Its light is piercingly bright and you can feel its power repelling your inner darkness. Your legs feel paralyzed in its presence.</p>\n<p>&quot;Release Mr. Frodo now, you parasite!&quot; Sam says, &quot;You think I don&#39;t know a Dark Lord when I see one? You twisted his soul and latched on! {if gollumKilledByYou=1:You even made him slaughter a companion without mercy! }You didn&#39;t destroy the Ring -- YOU ARE THE RING!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You unsheathe your weapon and lunge at Sam.\" role=\"link\" tabindex=\"0\">You unsheathe your weapon and lunge at Sam.</a></p>",
		'passages': {
		},
	},
	'You unsheathe your weapon and lunge at Sam.': {
		'text': "<p>Sam goes for his frying pan. He deflects your strikes, begging you to <a class=\"squiffy-link link-section\" data-section=\"fight back against Sauron's power\" role=\"link\" tabindex=\"0\">fight back against Sauron&#39;s power</a>. The volcano begins to quake now as you viciously try to <a class=\"squiffy-link link-section\" data-section=\"murder your best friend\" role=\"link\" tabindex=\"0\">murder your best friend</a>.</p>",
		'passages': {
		},
	},
	'fight back against Sauron\'s power': {
		'text': "<p>For a moment, Sam&#39;s word reach you. You falter in your attacks and Sam knocks your weapon from your grip. It lands against a stone and snaps in half. {if hasSwordSting=1:Your uncle&#39;s enchanted sword rests in pieces.}</p>\n<p>{if hasBrightMail=0:You run for what&#39;s left of your weapon, but Sam is fast and smacks you in the head with the pan.}\n{if hasBrightMail=1:You run for what&#39;s left of your weapon. Sam tries to get the advantage on you, but the light from a nearby lava spurt glistens off your +2 elven bright mail and momentarily blinds your friend. Sam swings his pan, misses, and tumbles to the ground.}</p>\n<p>{if hasBrightMail=0:<a class=\"squiffy-link link-section\" data-section=\"You fall flat on your back.\" role=\"link\" tabindex=\"0\">You fall flat on your back.</a>}\n{if hasBrightMail=1:<a class=\"squiffy-link link-section\" data-section=\"You reclaim your weapon and knock away Sam's.\" role=\"link\" tabindex=\"0\">You reclaim your weapon and knock away Sam&#39;s.</a>}</p>",
		'passages': {
		},
	},
	'murder your best friend': {
		'text': "<p>You haven&#39;t time for this &#39;best friend&#39; nonsense. You attack Sam with all your fury. He flashes the Light at you once more, causing you to divert your gaze. You stumble and trip.</p>\n<p>Sam wings his frying pan around strikes you in the face. You drop your weapon, stunned.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You fall flat on your back.\" role=\"link\" tabindex=\"0\">You fall flat on your back.</a></p>",
		'passages': {
		},
	},
	'You fall flat on your back.': {
		'text': "<p>&quot;One last time... release him,&quot; Sam says.</p>\n<p>You tell Sam he&#39;ll have to throw you into the pit himself.</p>\n<p>&quot;So be it,&quot; and Sam strikes you once more in the head.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue256\" role=\"link\" tabindex=\"0\">You fade to black in the fires of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue256': {
		'text': "<p>When you awake, you are no longer in the mountain. You are no longer in Mordor.</p>\n<p>You are chained to a bed in a white bedroom. You hear a grizzled voice speak, &quot;You have a very loyal friend, Frodo Baggins.&quot;</p>\n<p>You see Gandalf in his {if gandalfWhite=0:grey}{if gandalfWhite=1:white} robes, sitting at the foot of your bed. He clutches his staff tightly. You demand to know what happened.</p>\n<p>&quot;The Ring was destroyed, but not before Sauron&#39;s soul claimed you. Samwise could have thrown you into the mountain to end the madness, but he chose to save you instead.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue257\" role=\"link\" tabindex=\"0\">Gandalf goes on to tell you about the War of the Ring.</a></p>",
		'passages': {
		},
	},
	'_continue257': {
		'text': "<p>A great battle was fought on Pelenor Fields. Many were lost at the Black Gates{if boromirDead=0:, including Boromir, who died protecting Gondor}. Shortly after, the eagles arrived{if eaglesComing=1: to dispose of the rogue birds that had been pursuing you}. Gandalf rode one into Mordor and found you and Sam at the foot of the mountain. You were carried back to the White City of Minas Tirith. </p>\n<p>&quot;Since then, I&#39;ve been slowly draining Sauron&#39;s poisonous intent from your body,&quot; Gandalf explains. &quot;{if gandalfWhite=0:It&#39;s been a difficult task, but it&#39;s far easier to cleanse a hobbit than an ancient Ring of power. I imagine you and I have a few more days left to go.}{if gandalfWhite=1: Fortunately, my fall in Moria instilled me with a great power. One which I&#39;ve used to almost entirely cleanse Sauron from your being.}&quot;</p>\n<p>You fight against the bed restraints, demanding to be released.</p>\n<p>Gandalf drinks a glass of water and raises his staff towards you. &quot;And now back to work.{if gandalfAngry&gt;9: After all your nonsense, I&#39;m going to enjoy this.}&quot;</p>\n<p>A week later, <a class=\"squiffy-link link-section\" data-section=\"he has completely exorcised Sauron from you.\" role=\"link\" tabindex=\"0\">he has completely exorcised Sauron from you.</a></p>",
		'passages': {
		},
	},
	'You reclaim your weapon and knock away Sam\'s.': {
		'text': "<p>&quot;Do it, kill me!&quot; Sam cries, as you aim your broken blade at his throat.</p>\n<p>But his plea to fight back against Sauron&#39;s power has touched you. You can&#39;t kill your best friend, but you won&#39;t give up your newfound seat of power. </p>\n<p>You help Sam to his feet and tell him that together you can end the war.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue258\" role=\"link\" tabindex=\"0\">Because Mordor needs a king, and this king needs his gardener.</a></p>",
		'passages': {
		},
	},
	'_continue258': {
		'text': "<p>Moments later, you both come outside. {if eaglesComing=1:The orcs have driven away the eagles, who no longer seek you now that the Ring is destroyed.}</p>\n<p>You return to Barad-dûr and order your troops to secure the Black Gate. You then journey there to meet with Aragorn who has led Gondor&#39;s army to your doorstep. The orcs stay their arms by your command.</p>\n<p>He pleads with you to open the gate, but you refuse his commands. The King of Mordor does not answer to Gondor. You order the remains of your broken fellowship to take their army and return to Minas Tirith. There will be no war today.{if gandalfAngry&gt;9: Gandalf shouts curses at you, still peeved about all your earlier shenanigans.} Eventually, they leave.</p>\n<p>{if merryPippinInRohan=1:Merry and Pippin are very impressed with your new title and ask if they can join you. You and Sam let them in. You now have all four hobbits back together again.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue259\" role=\"link\" tabindex=\"0\">You return to the tower and spend the next several months restoring Mordor&#39;s glory.</a></p>",
		'passages': {
		},
	},
	'_continue259': {
		'text': "<p>Thanks to Sam&#39;s gardening skills, he turns the Mordor wasteland into a green, agricultural utopia. Your main exports are potatoes, carrots and squash. Sam strikes a trade deal with the eastern countries and your economy booms.</p>\n<p>{if merryPippinInRohan=1:Merry and Pippin open a string of salons where they help give orcs much-needed make-overs. It turns out orcs are pretty sexy when you just hose all the gunk off them. Swimsuit calendars becomes another of your chief exports.}</p>\n<p>With a hobbit as king, the orcs change their barbaric ways and embrace afternoon tea, golf, and planting shrubberies. Mordor&#39;s second name becomes East Hobbiton.</p>\n<p>Aragorn becomes King of Gondor, but never gets around to attacking you again. He&#39;s still not sure what to make of you being the new Dark Lord. He starts to wonder if the real Dark Lord all along... was man?</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue260\" role=\"link\" tabindex=\"0\">And so your legend comes to an end.</a></p>",
		'passages': {
		},
	},
	'_continue260': {
		'text': "<p>You, Frodo of the Shire have risen to become the new King of Mordor. Mordor bends to your every whim and no other country dares attack you. With Sam by your side, you&#39;re both ruthless and compassionate.</p>\n<p>Eventually, the elves travel to the Grey Havens. Men and dwarves beg to go with them, afraid of being left alone with you. Your friends in the Shire still don&#39;t know where you ran off to, but your mail is piling up.</p>\n<p>You broke the Fellowship, but forged a new one with Mordor, stronger and more powerful than any Ring. Middle-Earth is forever changed thanks to you.</p>\n<p>{if jam=0:You have a cup of tea to celebrate.}\n{if jam=1:You have some toast and jam to celebrate.}</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'he has completely exorcised Sauron from you.': {
		'text': "<p>A lot of stuff went down during your time in Mordor. Aragorn became king of Gondor{if fellowship&lt;3:, and married both the ever-interchangeable Arwen and Glorfindel}.{if merryPippinInRohan=1: Merry and Pippin led an army of tree people against Isengard{if witchKingDanceOff=0:, and somehow helped kill the Witch King.}} Legolas and Gimli learned the true meaning of friendship and brought forth a new age of peace between elves and dwarves.{if fellowship=1: And Beorn successfully stole all the pic-a-nic baskets from Ranger Smith.}</p>\n<p>Eventually you and Sam return home to the Shire. You feel like crap for letting Sauron get inside your head{if gollumKilledByYou=1:, and for letting you needlessly execute Gollum.} The real hero of this journey was Sam, who somehow managed to save you and Middle-Earth all in one go. Sam deserves all the medals and gift cards he&#39;s been getting. You deserve all those kicks in the butt you keep getting. {if gandalfAngry&gt;9:Even Gandalf&#39;s taken a few more swings at you for good measure.}</p>\n<p>When you get home, you discover someone burned Bag End down in your absence. Sam lets you stay on his couch, but you have to sleep outside on nights when his girlfriend Rosie comes over. {if merryPippinInRohan=1:You ask Merry and Pippin if you can stay at their place, but they don&#39;t fancy a former Dark Lord staying with them. They never forgot you screaming like a possessed banshee when Gandalf brought you back from Mordor, so you continue to sleep outside.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue261\" role=\"link\" tabindex=\"0\">Eventually, you leave the Shire.</a></p>",
		'passages': {
		},
	},
	'_continue261': {
		'text': "<p>You arrive in Rivendell to discover Gandalf and the elves have left for &#39;the Grey Havens&#39;, and didn&#39;t bother inviting you.</p>\n<p>Since Rivendell is now deserted, you move in and rename it Frododell. You put up a sign outside reading, &quot;ONLY FRODOS ALLOWED&quot;.</p>\n<p>Then you put up your hobbit feet by the fireplace and enjoy {if jam=0:a nice cup of tea}{if jam=1:some toast with jam}.</p>\n<p>This is your town now. You may not be King of Mordor anymore, but after all that walking, you, the new King of Frododell, deserve a piece of Middle-Earth to call your own.</p>\n<p>THE END.</p>",
		'passages': {
		},
	},
	'You are taken prisoner and brought to an underground Gondorian outpost.': {
		'text': "<p>A captain approaches you, accusing you of being Mordor spies. Someone refers to him as Faramir, son of Denethor. You realize he is Boromir&#39;s brother.</p>\n<p>&quot;I doubt <a class=\"squiffy-link link-section\" data-section=\"you are an idiot tourist\" role=\"link\" tabindex=\"0\">you are an idiot tourist</a>,&quot; Boromir says to you. &quot;What business have you on Mordor&#39;s border? Come now, <a class=\"squiffy-link link-section\" data-section=\"be truthful about your mission\" role=\"link\" tabindex=\"0\">be truthful about your mission</a>.&quot;</p>",
		'passages': {
		},
	},
	'you are an idiot tourist': {
		'text': "<p>You explain that you really are an idiot tourist who wandered too far from the Shire and then kept going. Faramir seems doubtful about your words.</p>\n<p>{if gollumDead=1:Then Sam chimes in, &quot;Foodies! We&#39;re foodies! Food tourists. We travel town to town, sampling local delicacies so we can write about them. We just came from Lothlorien and were on our way to Minas Tirith when we took a wrong turn upriver.&quot;}</p>\n<p>{if gollumDead=1:Faramir orders the guards to search Sam. They discover many cooking pans, spices, and samples of elven lembas bread. Faramir nods, &quot;There seems to be some truth to your words. We haven&#39;t had a well-cooked meal in weeks; I don&#39;t suppose you cook?&quot;}</p>\n<p>{if gollumDead=1:&quot;I picked up a delicious recipe in Bree for butternut beef stew if your men are hungry,&quot; Sam says. Faramir orders him to mix up a batch for the soldiers.}</p>\n<p>{if gollumDead=1:Hours later, <a class=\"squiffy-link link-section\" data-section=\"all the soldiers' bellies are full of Sam's stew.\" role=\"link\" tabindex=\"0\">all the soldiers&#39; bellies are full of Sam&#39;s stew.</a>}</p>\n<p>{if gollumDead=0:Gollum screams, &quot;Our Precious! He has&#39;es our Precious!&quot;}</p>\n<p>{if gollumDead=0:Faramir glares at you and orders an immediate search. His men frisk you and <a class=\"squiffy-link link-section\" data-section=\"they discover the One Ring\" role=\"link\" tabindex=\"0\">they discover the One Ring</a> on a chain around your neck. You glare back at Gollum and mouth, &quot;thanks a lot.&quot;}</p>",
		'passages': {
		},
	},
	'all the soldiers\' bellies are full of Sam\'s stew.': {
		'text': "<p>&quot;That, my friends, was the finest meal my soldiers and I have had in months,&quot; Faramir says. His soldiers agree, more healthy and hearthy than before you arrived.</p>\n<p>{if boromirDead=0:<a class=\"squiffy-link link-section\" data-section=\"Faramir offers you a map.\" role=\"link\" tabindex=\"0\">Faramir offers you a map.</a>}</p>\n<p>{if boromirDead=1:But on a more solemn note, <a class=\"squiffy-link link-section\" data-section=\"Faramir opens a bottle of wine.\" role=\"link\" tabindex=\"0\">Faramir opens a bottle of wine.</a>}</p>",
		'passages': {
		},
	},
	'Faramir offers you a map.': {
		'text': "<p>&quot;Take this map,&quot; he says. &quot;It&#39;ll lead you safely away from Mordor and back to the Shire without crossing any of our patrol routes. Be safe, little hobbits.&quot;</p>\n<p>As they bring you back to the cave entrance, Sam sees a trail on the map leading down to Minas Morgul, your next entry point into Mordor.</p>\n<p>&quot;Let&#39;s get back to our quest,&quot; he says.</p>\n<p>You are <a class=\"squiffy-link link-section\" data-section=\"back on the trail towards Minas Morgul.\" role=\"link\" tabindex=\"0\">back on the trail towards Minas Morgul.</a></p>",
		'passages': {
		},
	},
	'Faramir opens a bottle of wine.': {
		'text': "<p>He pours himself a drink, chugs it and tells his soldiers, &quot;I learned earlier today that my brother Boromir was found dead at Amon Hen, slain by orc arrows. Normally, I&#39;d stand true to my duty to Gondor, but this fine meal has invigorated me. I want to avenge my brother.&quot;</p>\n<p>You ask how he plans to do that.</p>\n<p>&quot;The Uruk-Hai who killed my brother were also found dead, but an another armament of them was dispatched to Mordor not too long ago. There&#39;s an old trading route through the mountains we can use to attack one of their camps, near the foot of Mt. Doom.&quot;</p>\n<p>His men agree they would like to ambush the surviving Uruk-Hai in honour of Boromir. They thank you for the meal and prepare for the attack.</p>\n<p>&quot;This is our chance, Frodo,&quot; Sam whispers to you. &quot;We can <a class=\"squiffy-link link-section\" data-section=\"follow Faramir into Mordor\" role=\"link\" tabindex=\"0\">follow Faramir into Mordor</a> and let him guide us to Mt. Doom.&quot;</p>\n<p>You overhear one of the soldiers talking about another entrance into Mordor down south - a citadel called Minas Morgul - and wonder if you should <a class=\"squiffy-link link-section\" data-section=\"take your chances with the citadel\" role=\"link\" tabindex=\"0\">take your chances with the citadel</a> instead.</p>",
		'passages': {
		},
	},
	'take your chances with the citadel': {
		'text': "<p>You aren&#39;t sure if you should push your luck with Faramir. You recommend you and Sam slip out of this camp once Faramir and his men and head south.</p>\n<p>Sam reluctantly agrees. Once Faramir&#39;s men have gotten drunk enough, they aren&#39;t aware enough to see you and Sam sneak out of the cave. You continue your journey.</p>\n<p>Eventually, you are <a class=\"squiffy-link link-section\" data-section=\"back on the trail towards Minas Morgul.\" role=\"link\" tabindex=\"0\">back on the trail towards Minas Morgul.</a></p>",
		'passages': {
		},
	},
	'be truthful about your mission': {
		'text': "<p>You reveal the One Ring on the chain around your neck. You tell Faramir you came from Rivendell with his brother on a secret mission to destroy the Ring, but were separated shortly after Boromir attacked you.</p>\n<p>{if gollumDead=0:A look of shock washes over Gollum as he hears your plan to destroy his Precious. He doesn&#39;t know what to think.}\n{if gollumDead=0:{@gollumKnows=1}}</p>\n<p>Faramir is surprised at your forthcoming.{if gandalfDead=1: He reveals that Boromir was found dead on the shore you left him, slain by Orcs.}</p>\n<p>For a moment, you think he&#39;ll take the Ring like Boromir, but your honesty helps him resist the temptation. &quot;I will not be like Boromir. You must complete your mission. My soldiers will continue holding off Mordor&#39;s forces until then. Go now, before my men learn what you carry.&quot;</p>\n<p>Faramir frees you. You hurry away, <a class=\"squiffy-link link-section\" data-section=\"back on the trail towards Minas Morgul.\" role=\"link\" tabindex=\"0\">back on the trail towards Minas Morgul.</a></p>",
		'passages': {
		},
	},
	'they discover the One Ring': {
		'text': "<p>Faramir&#39;s eyes widen with greed as he looks upon the Ring, just as Boromir&#39;s did. He knows what this piece of jewelry is and what it can do. </p>\n<p>&quot;The city of Osgiliath is under seige and my men are weary,&quot; he says. &quot;We could use this to push back against Mordor&#39;s forces.&quot;</p>\n<p>He hesitates taking the Ring, but his contempt for your treachery gives in. He orders you taken to the city of Osgiliath to face the horde.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are bound and taken to Osgiliath.\" role=\"link\" tabindex=\"0\">You are bound and taken to Osgiliath.</a></p>",
		'passages': {
		},
	},
	'You are bound and taken to Osgiliath.': {
		'text': "<p>Your brief time in this ruined city is a total gong show. </p>\n<p>Shortly after you arrive, orcs attack the city. At first, Faramir thinks your presence alone will drive back the invading forces back, but they only seem more enraged. Then he tries to use the Ring himself, but Gollum attacks him. You and Sam flee from his men.</p>\n<p>The next several minutes is nothing but Yakety Sax. Faramir and his men chase you, then the orcs chase his men. Then you chase the orcs. You weave back and forth through the ruins until you, Sam and Gollum find an escape route and return back towards Mordor. Faramir&#39;s soldiers are left to deal with the orcs.</p>\n<p>&quot;Let&#39;s not go back to Osgiliath,&quot; Sam says. &quot;It is a silly place.&quot;</p>\n<p>You find yourselves <a class=\"squiffy-link link-section\" data-section=\"back on the trail towards Minas Morgul.\" role=\"link\" tabindex=\"0\">back on the trail towards Minas Morgul.</a></p>",
		'passages': {
		},
	},
	'back on the trail towards Minas Morgul.': {
		'text': "<p>{if gollumKnows=1:Gollum isn&#39;t thrilled to be guiding you, now knowing that you plan to destroy the Ring. The gears in his head are turning the entire trip.}</p>\n<p>You soon arrive at the citadel of Minas Morgul, where you see the Morgul army emerge from its gates and march unto Gondor, towards the white city of Minas Tirith.</p>\n<p>Sam looks concerned. &quot;We&#39;ll never get through those gates either. I don&#39;t know why we came all this way.&quot;</p>\n<p>{if gollumDead=1:<a class=\"squiffy-link link-section\" data-section=\"You hear an overhead screech.\" role=\"link\" tabindex=\"0\">You hear an overhead screech.</a>}</p>\n<p>{if gollumDead=0:Gollums points towards the cliff face surrounding the tower. &quot;Secret stairs, little hobbitses. We takes the secret stairs.&quot;}</p>\n<p>{if gollumDead=0:Besides walking into certain death, you have no other options. <a class=\"squiffy-link link-section\" data-section=\"You follow Gollum towards the cliffs and he reveals a hidden staircase leading up into the mountains.\" role=\"link\" tabindex=\"0\">You follow Gollum towards the cliffs and he reveals a hidden staircase leading up into the mountains.</a>}</p>",
		'passages': {
		},
	},
	'You hear an overhead screech.': {
		'text': "<p>The WITCH KING soars over the citadel on his winged beast, watching over the army. You{if gollumDead=0:, Gollum} and Sam try to hide, but it doesn&#39;t take long for him to spot you from the air. </p>\n<p>Several orcs march on your position, as well as mounted Black Riders. They encircle you{if gollumDead=0:, Gollum} and Sam. You are taken prisoner and brought into the citadel.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue262\" role=\"link\" tabindex=\"0\">You are thrown into the dungeon.</a></p>",
		'passages': {
		},
	},
	'_continue262': {
		'text': "<p>After several hours of waiting, a guest arrives. It is a larged, fanged emissary, otherwise known as the MOUTH OF SAURON. </p>\n<p>He spies the Ring under your cloak and tells the orcs, &quot;Bring our guests to the Dark Lord. Please, take special care of them.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue263\" role=\"link\" tabindex=\"0\">You are escorted out into Mordor.</a></p>",
		'passages': {
		},
	},
	'_continue263': {
		'text': "<p>You now march with a large procession of soldiers through the enemy encampments. In the distance you see Mt. Doom. Next to it is the great Tower of Barad-dûr, with a giant flaming eye atop it.</p>\n<p>{if gollumDead=0:Gollum squeals, &quot;Noooo, not the Dark Lord! Anything buts him!&quot;}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You ascend into Sauron's tower.\" role=\"link\" tabindex=\"0\">You ascend into Sauron&#39;s tower.</a></p>",
		'passages': {
		},
	},
	'follow Faramir into Mordor': {
		'text': "<p>You go with Sam&#39;s plan and wait until the soldiers head out on their horses. From there, it&#39;s easy enough to sneak past the remaining soldiers and follow Faramir on the trading route. Their drunken raucous makes it incredibly easy to follow their trail.</p>\n<p>From there, you spend hours hurrying along an unremarkable trail through the mountains, easily sneaking into Mordor without detection. You bypass the citadels of Minas Morgul and Cirith Ungol completely, until you find yourself on the plains of Mordor.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue264\" role=\"link\" tabindex=\"0\">You enter the heart of Mordor.</a></p>",
		'passages': {
		},
	},
	'_continue264': {
		'text': "<p>Here, you see Mt. Doom up ahead. A tower is in the distance, adorned with a great flaming eye. You see an orc camp ahead, also in flames. Several of Faramir&#39;s men ride around it while orcs flee in terror.</p>\n<p>You and Sam duck behind a rock as Faramir rides past nearby. Faramir drunkenly slaughters the Uruk-Hai as he rides in circles, shouting &quot;This is for Boromir, you dirty-arse shraks!&quot;</p>\n<p>One orc knocks him off his horse. As he falls prone upon the ground, the orc prepares for a killing strike. You have an opportunity to <a class=\"squiffy-link link-section\" data-section=\"run in and stab the orc from behind\" role=\"link\" tabindex=\"0\">run in and stab the orc from behind</a> but may give away your position. Sam insists <a class=\"squiffy-link link-section\" data-section=\"you hurry past while the orcs are distracted\" role=\"link\" tabindex=\"0\">you hurry past while the orcs are distracted</a>.</p>",
		'passages': {
		},
	},
	'you hurry past while the orcs are distracted': {
		'text': "<p>But hurrying past is a mistake. Faramir recovers in time to strike the orc upwards through its skull. He gets to his feet and sees you and Sam sneaking past.</p>\n<p>&quot;You ARE Mordor spies!&quot; he exclaims. &quot;Quick, men, kill them!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue265\" role=\"link\" tabindex=\"0\">You run!</a></p>",
		'passages': {
		},
	},
	'_continue265': {
		'text': "<p>But Faramir&#39;s horses are definitely faster than two hobbits. They encircle and trap you in the burning camp, raising their swords for the slaughter.</p>\n<p>Sam pulls you in, grabs your Ring, and forces it onto you finger.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue266\" role=\"link\" tabindex=\"0\">You vanish from the soldiers&#39; sight.</a></p>",
		'passages': {
		},
	},
	'_continue266': {
		'text': "<p>Sam pushes you away as the soldiers come for him. They lower their weapons as you vanish, though, surprised at this sudden turn. Faramir grabs Sam, demanding to know where you went. </p>\n<p>You hover around the soldiers, watching in horror as they threaten Sam.</p>\n<p>Your Ring whispers, &quot;<a class=\"squiffy-link link-section\" data-section=\"Use me and save him!\" role=\"link\" tabindex=\"0\">Use me and save him!</a>&quot;</p>\n<p>But you hear Sam shout, &quot;<a class=\"squiffy-link link-section\" data-section=\"Just run!\" role=\"link\" tabindex=\"0\">Just run!</a></p>",
		'passages': {
		},
	},
	'Use me and save him!': {
		'text': "<p>You raise your hand and shout for the soldiers to stay their hands. They find themselves complying against their will. Their swords fall to the ground.</p>\n<p>You urge them to leave immediately. Faramir tells his men to follow his lead and they leave Sam alone, riding back to their cave.</p>\n<p>You remove the Ring so Sam can see you.</p>\n<p>&quot;You used the Ring,&quot; Sam says, &quot;As in, you REALLY used it. You bent the will of those men... like a proper Dark Lord.&quot;</p>\n<p>You tell Sam it was the only way to save his life. He shrugs, &quot;Okay.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue267\" role=\"link\" tabindex=\"0\">The Ring&#39;s whispers now feel like drums in your head.</a></p>",
		'attributes': ["precious+=1","precious+=1"],
		'passages': {
		},
	},
	'_continue267': {
		'text': "<p>You stumble and falter as you and Sam head towards Mt. Doom.</p>\n<p>{if eaglesComing=0:You see the Witch King on his flying fellbeast overhead chasing after Faramir&#39;s men, believing you&#39;re with them.}{if eaglesComing=1:You see the eagles overhead chasing after Faramir&#39;s men, believing you&#39;re with them. Behind them, you see the Witch King pursuing the eagles on his flying fellbeast.} Hopefully, he won&#39;t be a problem up ahead.</p>\n<p>But as you approach the mountain, the Ring&#39;s power grips you tightly. You still insist on carrying it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'Just run!': {
		'text': "<p>You run as far away from the soldiers as you can, abandoning Sam to his fate.</p>\n<p>Then, suddenly, a screech permeates the air and the great winged fellbeast of the Witch King descends upon the soldiers. Faramir is crushed instantly by its feet and several soldiers run screaming, only to get slaughtered by the beast&#39;s fangs and swiping tail.</p>\n<p>The Witch King orders some nearby orcs, &quot;Take this halfling to Cirith Ungol for safekeeping. I&#39;ll inform the Dark Lord our guest has arrived.&quot;</p>\n<p>He flies away and the orcs drag Sam away towards a tower in the distance.</p>\n<p>Sam has sacrificed himself to save you. You consider trying to <a class=\"squiffy-link link-section\" data-section=\"rescue Sam from the tower\" role=\"link\" tabindex=\"0\">rescue Sam from the tower</a>, but he trusted you to <a class=\"squiffy-link link-section\" data-section=\"complete the Fellowship's mission\" role=\"link\" tabindex=\"0\">complete the Fellowship&#39;s mission</a>.</p>",
		'passages': {
		},
	},
	'rescue Sam from the tower': {
		'text': "<p>But you can&#39;t abandon Sam after what he just did. Gearing up your courage, you hurry after the orcs towards Cirith Ungol.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue268\" role=\"link\" tabindex=\"0\">The sun is setting as you approach the tower.</a></p>",
		'passages': {
		},
	},
	'_continue268': {
		'text': "<p>Two orc guards at the front door are enjoying a quiet evening, resting assured that their prisoner will soon be delivered to the Dark Lord.</p>\n<p>Then a {if hasSwordSting=1:glowing }blade strikes through the air, stabbing the first orc through the chest, then swinging around to decapitate the second.</p>\n<p>You kick down the front door to the courtyard, pull off your Ring, and demand to know where Sam is.</p>\n<p>The five hundred orcs inside the courtyard draw their weapons and advance on you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue269\" role=\"link\" tabindex=\"0\">You go to war, Frodo-style.</a></p>",
		'passages': {
		},
	},
	'_continue269': {
		'text': "<p>The Ring has no weight on you as you spin, flip and weave around the room at super-hobbit speed, cutting down orcs at the ankles and finishing them with blow after blow. Your love for Sam has given you the strength to outmaneuver Mordor&#39;s trained army.</p>\n<p>You climb up a flight of stairs and kick over a cauldron of scalding oil onto the orcs below. You then throw a lantern to the ground, igniting the courtyard floor, and set all the orcs aflame. </p>\n<p>You rush up the spiraling staircase towards the top of the tower.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue270\" role=\"link\" tabindex=\"0\">And then the Witch King shows up.</a></p>",
		'passages': {
		},
	},
	'_continue270': {
		'text': "<p>Near one of the upper windows, you see the Witch King&#39;s fellbeast fly past. The Witch King leaps in through the window and bars your way. You attack him, but he easily parries your blow with his mace.</p>\n<p>&quot;Fool, no MAN can kill me,&quot; he says with surgical precision.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue271\" role=\"link\" tabindex=\"0\">You push him off the stairs.</a></p>",
		'passages': {
		},
	},
	'_continue271': {
		'text': "<p>The Witch King plummets several stories into the raging fires below, breaking every bone in his body and burning alive inside and out. </p>\n<p>He survives, of course.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue272\" role=\"link\" tabindex=\"0\">Meanwhile, Sam is being held captive upstairs.</a></p>",
		'passages': {
		},
	},
	'_continue272': {
		'text': "<p>Tied to a chair, Sam watches in horror as the orcs tear his backpack apart and fight over his cooking utensils.</p>\n<p>Then the orcs are taken by surprise as an unusual shadow hovers outside the window.</p>\n<p>&quot;Frodo!&quot; Sam exclaims as he sees you riding the Witch King&#39;s fellbeast.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue273\" role=\"link\" tabindex=\"0\">Sam breaks free.</a></p>",
		'passages': {
		},
	},
	'_continue273': {
		'text': "<p>Using renewed strength, Sam rips the arms off the chair, beats the orcs senseless with his fists, and runs for the window.</p>\n<p>You catch him as he leaps to you.</p>\n<p>Riding the fellbeast together, you <a class=\"squiffy-link link-section\" data-section=\"soar off towards Mt. Doom\" role=\"link\" tabindex=\"0\">soar off towards Mt. Doom</a>.</p>\n<p>&quot;I knew you&#39;d come back for me,&quot; he cries happily. You <a class=\"squiffy-link link-passage\" data-passage=\"kiss him\" role=\"link\" tabindex=\"0\">kiss him</a>.</p>",
		'passages': {
			'kiss him': {
				'text': "<p>But he kisses you first.</p>",
			},
		},
	},
	'soar off towards Mt. Doom': {
		'text': "<p>The Witch King hobbles after you on foot, on fire, shaking his fist in rage. You just stole his ride.</p>\n<p>{if eaglesComing=1:The rogue eagles suddenly appear to bar your path, but you fly into their fray and roundhouse-kick their leader in the beak. He panics and flies away, taking the other eagles with him.}</p>\n<p>As you fly over Mt. Doom, you and Sam <a class=\"squiffy-link link-section\" data-section=\"throw the Ring into the volcano together\" role=\"link\" tabindex=\"0\">throw the Ring into the volcano together</a>.</p>",
		'passages': {
		},
	},
	'throw the Ring into the volcano together': {
		'text': "<p>It&#39;s a beautiful sight as the volcano explodes behind you, taking Mordor&#39;s army with it. You both ride your fellbeast into the sunset.</p>\n<p>&quot;Let&#39;s go home,&quot; Sam says, hugging you tightly.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue274\" role=\"link\" tabindex=\"0\">You fly back to the Shire.</a></p>",
		'passages': {
		},
	},
	'_continue274': {
		'text': "<p>Weeks later, Gandalf shows up at your front door demanding answers. {if gandalfDead=1:You&#39;re delighted to see him alive, after his tragic death in Moria.}</p>\n<p>You and Sam invite him and tell your story. He tells you of the Fellowship&#39;s adventures in Rohan, and their war against Saruman came to an abrupt end shortly after the battle of Helm&#39;s Deep when all of Mordor exploded and several pieces of it landed on Saruman&#39;s tower.</p>\n<p>Most of the Fellowship has gone their own way now, including Aragorn who thought he&#39;d be King of Gondor after King Denethor&#39;s untimely death. But then the land of Gondor suddenly embraced democracy and voted in a guy named Darrylgorn instead.</p>\n<p>Gandalf says he wants to <a class=\"squiffy-link link-section\" data-section=\"go to a place called 'The Grey Havens'\" role=\"link\" tabindex=\"0\">go to a place called &#39;The Grey Havens&#39;</a> with the elves and wants you and Sam to leave everything behind and join him.</p>",
		'passages': {
		},
	},
	'go to a place called \'The Grey Havens\'': {
		'text': "<p>But then he shows you an actual map of Middle-Earth and it looks like the Grey Havens are just a few miles west of the Shire. You decline the offer since it&#39;s about as far as Bree. Instead of going through the trouble of moving, you could just visit him on any weekend.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue275\" role=\"link\" tabindex=\"0\">And you do just that.</a></p>",
		'passages': {
		},
	},
	'_continue275': {
		'text': "<p>Every weekend, you and Sam fly to the Grey Havens to see how Gandalf&#39;s doing. He&#39;s always surprised whenever your fellbeast shows up and he&#39;s always happy to watch the kids while you and Sam go see a movie. Gandalf&#39;s good like that.</p>\n<p>And that&#39;s how your journey ends! Thanks for enjoying &#39;Lord of the Rings&#39;! You&#39;ve been a real pantload!</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'complete the Fellowship\'s mission': {
		'text': "<p>Tears in your eyes, you abandon Sam to his fate.</p>\n<p>{if eaglesComing=1:You see the rogue eagles fly past overhead, following the orcs. You hope they won&#39;t be a problem at the mountain.}</p>\n<p>Hours later, you climb Mt. Doom, enter a cave, and find yourself at the edge of a fiery maw. The lava below seathes with molten malice.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue276\" role=\"link\" tabindex=\"0\">The Ring weighs down on you heavily.</a></p>",
		'passages': {
		},
	},
	'_continue276': {
		'text': "<p>It suddenly feels as heavy as an anvil. The Ring pulls you to the rocky ground. You collapse to your hands and knees, only a few feet from the cliff&#39;s edge.</p>\n<p>In your head, you hear Sam&#39;s cries and plees. His sacrifice gives you strength to stand again. You rip the chain from your neck, but it slips from your grasp before you can throw it. The Ring&#39;s weight anchors it to the ground. You are unable to move it.</p>\n<p>&quot;Sauron&#39;s will has bound it to the mountain,&quot; you hear a deep voice say behind you, &quot;The Dark Lord will not let you destroy it.&quot;</p>\n<p>You turn to see the Witch King standing in the cave entrance, barring your escape. Armed with his fiendish mace, he approaches you alone.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue277\" role=\"link\" tabindex=\"0\">You clench your fist and charge at him.</a></p>",
		'passages': {
		},
	},
	'_continue277': {
		'text': "<p>He pushes you back down towards the Ring.</p>\n<p>&quot;Once I knew we had taken the wrong halfling, I was certain you would come here,&quot; the Witch King sneers. &quot;Your friend&#39;s sacrifice was for naught, as were the lives of those soldiers you brought. Tell me, halfling, who else died for nothing?&quot;</p>\n<p>He raises his mace and prepares to crush you.</p>\n<p>You wonder... is it time to <a class=\"squiffy-link link-passage\" data-passage=\"give up and embrace your fate\" role=\"link\" tabindex=\"0\">give up and embrace your fate</a>, or <a class=\"squiffy-link link-section\" data-section=\"do what Sam said\" role=\"link\" tabindex=\"0\">do what Sam said</a>?</p>",
		'passages': {
			'give up and embrace your fate': {
				'text': "<p>You think back to all the death you witnessed and prepare to prepare to join the fallen. But Sam&#39;s voice keeps calling out to you... &quot;Just run!&quot;</p>",
			},
		},
	},
	'do what Sam said': {
		'text': "<p>You just run.</p>\n<p>The mace comes down and strikes the cliffside as you race past the Witch King.</p>\n<p>The ground shatters. The Witch King can&#39;t run away as the ledge crumbles under his feet, taking him and the Ring into the lava.</p>\n<p>&quot;Fool! No MAN can kill me-blblblabaaalblblbl....&quot; he gurgles as he vanishes into the volcano.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue278\" role=\"link\" tabindex=\"0\">Mt. Doom erupts.</a></p>",
		'passages': {
		},
	},
	'_continue278': {
		'text': "<p>You are thrown from the cave by a volcanic blast and hit your head on a rock.</p>\n<p>You black out, prepared to die as Mordor is destroyed around you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue279\" role=\"link\" tabindex=\"0\">The world goes dark.</a></p>",
		'passages': {
		},
	},
	'_continue279': {
		'text': "<p>You awaken hours later, rescued by an eagle. {if eaglesComing=1:The good kind of eagle, not the ones hunting you.}</p>\n<p>You are taken to Rivendell where you are nursed back to health. You rejoin with the remaining Fellowship{if gandalfDead=1:, including Gandalf who has miraculously survived his fall into Moria}.</p>\n<p>They tell you of their battles in Rohan and at Helm&#39;s Deep, and you tell them of Faramir and Sam&#39;s tragic sacrifice.</p>\n<p>Gandalf says, &quot;Our fallen will be honoured.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue280\" role=\"link\" tabindex=\"0\">So you return to the Shire and make a big Sam statue.</a></p>",
		'passages': {
		},
	},
	'_continue280': {
		'text': "<p>At first, everyone&#39;s really annoyed that you carved a giant marble statue of Samwise Gamgee and stuck it in the town square. But after you beat the crap out of anyone who tried to remove it, they eventually left the eyesore alone and went about their daily lives.</p>\n<p>Your sculpting skills are terrible, and Sam&#39;s statue looks like a frozen, filthy snowman, but you are so proud of him and you leave flowers at the site every day. But because Sam was a gardener and you&#39;re not, his memorial gradually gets overgrown with weeds and turns into a nightmarish scarecrow. Literally everyone in Hobbiton is scared to walk past it at night.</p>\n<p>But you like it. And every day, you sit on your front porch, enjoy {if jam=0:a cup of tea}{if jam=1:some toast with jam}, and pay your respects to Samwise Gamgee, the bravest hobbit of them all. You wish you could have saved him, but it was through Sam&#39;s sacrifice that all Middle-Earth could live.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'run in and stab the orc from behind': {
		'text': "<p>But even after what Boromir did, you can&#39;t let the same fate befall his brother. You run in, unsheathe your sword and stab his attacker in the back. Sam rushes in to help.</p>\n<p>As you tussle with the orc, the Light of Galadriel falls out of your bag and cracks open. Its light explodes across the camp, frightening away the remaining orcs. Faramir and his men are drawn towards the light{if hasSwordSting=1:, and your glowing sword, Sting}.</p>\n<p>Faramir struggles to his feet, weapon drawn. &quot;I am grateful for the aid, but you are clearly no tourists. So <a class=\"squiffy-link link-section\" data-section=\"speak the truth\" role=\"link\" tabindex=\"0\">speak the truth</a>!&quot;</p>\n<p>You&#39;re not sure if you can <a class=\"squiffy-link link-section\" data-section=\"lie to him again\" role=\"link\" tabindex=\"0\">lie to him again</a>.</p>",
		'passages': {
		},
	},
	'lie to him again': {
		'text': "<p>You tell Faramir that you and Sam are super-wizards, Servants of the Secret Shire, from the Order of Mithrandir the Grey. You were sent to Mordor to blow up Mt. Doom with your super-magic and destroy Sauron for good. </p>\n<p>Sam nods, &quot;Yes, yes, super-wizards. Super-magic. Best watch out.&quot;</p>\n<p>&quot;A glowing sword and a light show does not make a wizard,&quot; Faramir says. &quot;Either prove it, or <a class=\"squiffy-link link-section\" data-section=\"speak the truth\" role=\"link\" tabindex=\"0\">speak the truth</a>.&quot;</p>\n<p>You scrounge in your bag for anymore magical items and find {if hasSeed=0:nothing.}{if hasSeed=1:Galadriel&#39;s seed. You prepare to <a class=\"squiffy-link link-section\" data-section=\"flick it at them\" role=\"link\" tabindex=\"0\">flick it at them</a>.}</p>",
		'passages': {
		},
	},
	'flick it at them': {
		'text': "<p>Faramir and the others are surprised as you flick the seed past them and it lands in the dirt. You pray it does something useful... and it does.</p>\n<p>Hundreds of vines sprout from the ground around the camp, ensnaring any straggling orcs. Fortunately, none of the vines come for you or Faramir.</p>\n<p>Faramir smiles, &quot;That... was... awesome!&quot;</p>\n<p>He and his drunken men all laugh and cheer. &quot;Three cheers for the super-wizards!&quot;</p>\n<p>&quot;What are you waiting for?&quot; Faramir asks. &quot;Let&#39;s go to Mt. Doom!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Faramir's drunken soldiers travel to Mt. Doom.\" role=\"link\" tabindex=\"0\">You and Faramir&#39;s drunken soldiers travel to Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You and Faramir\'s drunken soldiers travel to Mt. Doom.': {
		'text': "<p>It&#39;s a crazy frat party as you and Faramir&#39;s troops storm across Mordor cutting down every orc camp in a drunken rage. At every camp, they chug mead and get drunker and drunker. {if eaglesComing=1:At some point, the rogue eagles attack, but Faramir&#39;s men swat them away with swords and throw beer bottles at them. The eagles flee with several cuts and bruises, not certain how to handle drunken idiots at this hour.}</p>\n<p>&quot;We&#39;ve got &#39;em on the ropes!&quot; Faramir shouts, &quot;Let&#39;s end this war TONIGHT!&quot;</p>\n<p>You all march up Mt. Doom singing tavern songs.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue281\" role=\"link\" tabindex=\"0\">You enter a cave and find the heart of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue281': {
		'text': "<p>You, Sam and Faramir&#39;s men all stand at the edge of a fiery pit, covered in orc blood. The soldiers all cheer victoriously.</p>\n<p>&quot;We&#39;re here, wizards!&quot; Faramir says. &quot;Do your magic!&quot;</p>\n<p>Sam whispers to you, &quot;Quick, throw it in before he catches on.&quot;</p>\n<p>But the volcano rumbles as you fish the Ring from your vest. You end up dropping it. It bounces across the rock and lands at Faramir&#39;s feet. He scoops it up by its chain and glares into its sinfully golden sheen, recognizing it for what it is.</p>\n<p>His drunken smile droops and you&#39;ve killed his buzz. &quot;This is a Ring of Power. THE Ring of Power. What&#39;s going on, wizards? Care to <a class=\"squiffy-link link-section\" data-section=\"be honest already\" role=\"link\" tabindex=\"0\">be honest already</a>?&quot;</p>\n<p>Your blood runs cold. You&#39;ll have to <a class=\"squiffy-link link-section\" data-section=\"come up with a really big lie\" role=\"link\" tabindex=\"0\">come up with a really big lie</a> to get out of this one.</p>",
		'passages': {
		},
	},
	'come up with a really big lie': {
		'text': "<p>The year is 51X6 A.D. The robot armies of Mordor are in a losing battle against the human resistance. In order to turn the tides, the machines create a time machine and send a ring-shaped quantum superconductor back to Middle-Earth&#39;s Second Age to absorb the power of the Dark Lord Sauron. They plan to use its power to crush mankind before the robot wars even start.</p>\n<p>You and Sam are TIME-COPS, sent back in time to intercept the Ring before it reaches Sauron in the past. Stranded in the present, you must destroy the Ring in this era so you can undo the next 2000 years of war.</p>\n<p>Faramir and his men stand in stunned silence. Even Sam&#39;s a little surprised at this whopper.</p>\n<p>&quot;So you&#39;re time-traveling wizards,&quot; Faramir summarizes. &quot;And this is a Ring of Power before it has any power. So... care to <a class=\"squiffy-link link-passage\" data-passage=\"show any proof?\" role=\"link\" tabindex=\"0\">show any proof?</a> Or can we <a class=\"squiffy-link link-section\" data-section=\"be honest already\" role=\"link\" tabindex=\"0\">be honest already</a>?&quot;</p>",
		'passages': {
			'show any proof?': {
				'text': "<p>You dig around in your bag for any evidence that you&#39;re a time-traveler.</p>\n<p>{if hasShampoo=0:{if hasTShirt=0:{if hasDVD=0:You have nothing.}}}</p>\n<p>{if hasShampoo=1:The elven <a class=\"squiffy-link link-passage\" data-passage=\"shampoo\" role=\"link\" tabindex=\"0\">shampoo</a> you received in Lothlorien comes in a plastic bottle.}</p>\n<p>{if hasTShirt=1:You still have the &quot;I&#39;m with stupid&quot; <a class=\"squiffy-link link-passage\" data-passage=\"T-shirt\" role=\"link\" tabindex=\"0\">T-shirt</a> from Bree.}</p>\n<p>{if hasDVD=1:Lady Galadriel gave you a <a class=\"squiffy-link link-passage\" data-passage=\"DVD\" role=\"link\" tabindex=\"0\">DVD</a> copy of &quot;Tommy Boy&quot; back in Lothlorien..}</p>",
				'attributes': ["soldierReaction1 = Faramir isn't quite convinced.","soldierReaction2 = The soldiers aren't sure if this is wizard trickery or not."],
			},
			'shampoo': {
				'text': "<p>You give Faramir the plastic shampoo bottle. He&#39;s fascinated by its plastic case and its 2-in-1 conditioner quality to help keep hair silky and smooth.</p>\n<p>{if proofTimeTravel=1:{soldierReaction1}}\n{if proofTimeTravel=2:{soldierReaction2}}\n{if proofTimeTravel=3:{@soldierReaction3=1}}\n{if @soldierReaction3=1:<a class=\"squiffy-link link-section\" data-section=\"They are ready to believe you and Sam are time-traveling wizards.\" role=\"link\" tabindex=\"0\">They are ready to believe you and Sam are time-traveling wizards.</a>}</p>",
				'attributes': ["proofTimeTravel+=1"],
			},
			'T-shirt': {
				'text': "<p>You show off the printed cotton T-shirt. He&#39;s amazed by the printed lettering and the tag on the back indicating that it is &quot;machine washable&quot;.</p>\n<p>{if proofTimeTravel=1:{soldierReaction1}}\n{if proofTimeTravel=2:{soldierReaction2}}\n{if proofTimeTravel=3:{@soldierReaction3=1}}\n{if @soldierReaction3=1:<a class=\"squiffy-link link-section\" data-section=\"They are ready to believe you and Sam are time-traveling wizards.\" role=\"link\" tabindex=\"0\">They are ready to believe you and Sam are time-traveling wizards.</a>}</p>",
				'attributes': ["proofTimeTravel+=1"],
			},
			'DVD': {
				'text': "<p>You reveal the DVD copy of &quot;Tommy Boy&quot; to Faramir and his men. They&#39;ve never seen a disc before, and they&#39;re even more intrigued by the back-of-case blurb that reads &quot;A good belly laugh of a movie. Rowdy, rambunctious and sweet-natured.&quot; (Kevin Thomas, Los Angeles Times)</p>\n<p>{if proofTimeTravel=1:{soldierReaction1}}\n{if proofTimeTravel=2:{soldierReaction2}}\n{if proofTimeTravel=3:{@soldierReaction3=1}}\n{if @soldierReaction3=1:<a class=\"squiffy-link link-section\" data-section=\"They are ready to believe you and Sam are time-traveling wizards.\" role=\"link\" tabindex=\"0\">They are ready to believe you and Sam are time-traveling wizards.</a>}</p>",
				'attributes': ["proofTimeTravel+=1"],
			},
		},
	},
	'They are ready to believe you and Sam are time-traveling wizards.': {
		'text': "<p>A soldier squeals, &quot;No wonder we made it this far! Your time-travel magic has made us INVINCIBLE!&quot;</p>\n<p>Faramir throws you the Ring. &quot;Let&#39;s do this, wizards! Let&#39;s blow up Mt. Doom!&quot;</p>\n<p>{if eaglesComing=1:<a class=\"squiffy-link link-section\" data-section=\"You hear an eagle's cry from above.\" role=\"link\" tabindex=\"0\">You hear an eagle&#39;s cry from above.</a>}\n{if eaglesComing=0:<a class=\"squiffy-link link-section\" data-section=\"You hear a beastly cry from above.\" role=\"link\" tabindex=\"0\">You hear a beastly cry from above.</a>}</p>",
		'passages': {
		},
	},
	'You hear an eagle\'s cry from above.': {
		'text': "<p>Faramir&#39;s soldiers stand aside, expecting to see eagles attacking them from above. Instead, they see eagles rain from the sky. One crash-lands nearby on the cliff. Atop the eagle&#39;s corpse is the WITCH KING with his hellish mace embedded in its skull.</p>\n<p>His flying fellbeast above slaughters the other eagles.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Witch King approaches your party.\" role=\"link\" tabindex=\"0\">The Witch King approaches your party.</a></p>",
		'passages': {
		},
	},
	'You hear a beastly cry from above.': {
		'text': "<p>You and the soldiers look above to see the WITCH KING in the sky over the volcano. He lunges off his flying fellbeast, down the volcano shaft, and performs a perfect three-point landing on your ledge. He stands up, wielding his hellish mace.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The Witch King approaches your party.\" role=\"link\" tabindex=\"0\">The Witch King approaches your party.</a></p>",
		'passages': {
		},
	},
	'The Witch King approaches your party.': {
		'text': "<p>He&#39;s all that stands between you and the fires.</p>\n<p>Faramir and his drunken men raise their swords.</p>\n<p>&quot;Here&#39;s the plan,&quot; he tells you. &quot;We&#39;ll attack him. Any time he kills us, use your time-travel magic to bring us back and try again. We&#39;ll fight this battle a million time-loops if that&#39;s what it takes.&quot;</p>\n<p>Before you can stop him, Faramir and his drunkards charge at the Witch King. The battle is hard and furious as they hack and smash one another. The Witch King easily tosses soldiers aside, but they get back up and try again, numb to the pain.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue282\" role=\"link\" tabindex=\"0\">Faramir stays in the battle, face to face with the Witch King.</a></p>",
		'passages': {
		},
	},
	'_continue282': {
		'text': "<p>&quot;No MAN can kill me!&quot; the Witch King boasts.</p>\n<p>&quot;We aren&#39;t MAN... we&#39;re MEN!&quot; Faramir laughs.</p>\n<p>They all charge the Witch King at once, pushing him towards the cliff&#39;s edge. Faramir pulls the mace out of the Witch King&#39;s arms and reels it back for a hefty swing.</p>\n<p>&quot;This one&#39;s for my brother,&quot; he says. &quot;Batter up, boys!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue283\" role=\"link\" tabindex=\"0\">Faramir smashes the Witch King into the fires below!</a></p>",
		'passages': {
		},
	},
	'_continue283': {
		'text': "<p>As the Witch King melts in the fires of Mt. Doom, all of Faramir&#39;s men high-five one another.</p>\n<p>&quot;How many time-loops did that take?&quot; Faramir asks.</p>\n<p>&quot;Uh... 4... 42,&quot; Sam lies. &quot;You all died 41 times. We magicked you back over and over until you got it right.&quot;</p>\n<p>They all fist-pump.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue284\" role=\"link\" tabindex=\"0\">You toss the Ring into the fire without hesitation.</a></p>",
		'passages': {
		},
	},
	'_continue284': {
		'text': "<p>Mt. Doom erupts.</p>\n<p>Faramir&#39;s drunken mob runs screaming out of the mountain as it explodes. You and Sam trail behind, but they&#39;re too fast for you.</p>\n<p>&quot;I can&#39;t believe any of that WORKED!&quot; Sam exclaims.</p>\n<p>The lava surrounds you and Sam. You find shelter on a large boulder.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue285\" role=\"link\" tabindex=\"0\">All seems lost.</a></p>",
		'passages': {
		},
	},
	'_continue285': {
		'text': "<p>And then a rope descends from above. Someone calls out, &quot;Grab on!&quot;</p>\n<p>You and Sam are lifted off the boulder, away from the exploding volcano. As you climb the rope, you discover it&#39;s hanging from an unusual silver flying contraption. A door opens from its side and a strange man is waving you in.</p>\n<p>&quot;Quickly, into the DeLorean!&quot; he shouts.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue286\" role=\"link\" tabindex=\"0\">You and Sam climb into the &quot;DeLorean&quot;.</a></p>",
		'passages': {
		},
	},
	'_continue286': {
		'text': "<p>You find yourselves in a passenger seat across from a white-haired man in a lab coat.</p>\n<p>You demand to know what&#39;s going on.</p>\n<p>&quot;Fractal chronology, Frodo!&quot; he tells you. &quot;Your universe is a temporal hotspot of alternate timelines and parallel realities. And the further you deviate from the primary timeline, the weaker the temporal resistance gets between those realities. Your choices have leaned so far into the meta-humour, you&#39;ve successfully breached the fourth wall and escaped Tolkien&#39;s vision completely.&quot;</p>\n<p>You demand to know what half those words mean.</p>\n<p>&quot;It&#39;ll all make sense in due time,&quot; he says. &quot;For now, just call me Doc.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue287\" role=\"link\" tabindex=\"0\">Doc takes you on a flying tour of Middle-Earth.</a></p>",
		'passages': {
		},
	},
	'_continue287': {
		'text': "<p>While Faramir and his men escaped Mt. Doom on their horses, the orcs below weren&#39;t so lucky, engulfed by the lava flow.</p>\n<p>But you once you get further out of Mordor, things get stranger.</p>\n<p>You fly over a fortress where Aragorn and the Fellowship are battling an army of 10,000 orcs. Only now there&#39;s cowboys and samurais in the mix. And then Gandalf shows up, alive and clad in white robes, riding a Tyrannosaurus Rex.</p>\n<p>&quot;Temporal anomalies are running rampant,&quot; Doc says. &quot;You probably thought those shampoo bottles and T-shirts were just stupid jokes, but their appearance was also a symptom of a larger calamity on the rise.&quot;</p>\n<p>&quot;How do we fix it?&quot; Sam asks.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue288\" role=\"link\" tabindex=\"0\">Doc lowers his shades.</a></p>",
		'passages': {
		},
	},
	'_continue288': {
		'text': "<p>&quot;We need to go back to the future and prevent &#39;Tommy Boy&#39; from ever reaching Middle-Earth.&quot;</p>\n<p>He hands you and Sam two pairs of sunglasses to wear. He then shifts the DeLorean into gear, turns on a Huey Lewis mix tape, and flies off into the horizon.</p>\n<p>You see a flash of lightning, followed by pure darkness.</p>\n<p>In the darkness, three giant words appear before you:</p>\n<p>TO BE CONTINUED...</p>\n<p>Which, in the context of this narrative, is another way of saying...</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'speak the truth': {
		'text': "<p>You tell Faramir everything. About the Ring, the Fellowship and Boromir. He&#39;s shocked that you&#39;re not actually food junkies, but is sympathetic towards your predicament.</p>\n<p>&quot;My brother died trying to take the Ring,&quot; he realizes. &quot;To see my face after his must bring you great dread, but I promise I will not be like Boromir. I will not try to take the Ring. But I cannot send you away either. So I will help you. My men and I will ride with you to Mt. Doom if you will have us.&quot;</p>\n<p>You wonder if you should <a class=\"squiffy-link link-section\" data-section=\"agree to Faramir's offer\" role=\"link\" tabindex=\"0\">agree to Faramir&#39;s offer</a>, or <a class=\"squiffy-link link-passage\" data-passage=\"decline and walk by yourselves\" role=\"link\" tabindex=\"0\">decline and walk by yourselves</a>.</p>",
		'passages': {
			'decline and walk by yourselves': {
				'text': "<p>You start walking away, but then remember Mt. Doom is still stupid far. Sam reminds you that Faramir has horses. You continue walking, but Sam drags you back anyway. It seems your choices don&#39;t have much weight when your companion has tired feet.</p>",
			},
		},
	},
	'agree to Faramir\'s offer': {
		'text': "<p>You agree to Faramir&#39;s aid. Sam and yourself climb onto the back of two of his men&#39;s horse and you all ride off together towards the mountain. In the distance, the Flaming Eye of Sauron gazes upon your approach.</p>\n<p>Orcs ride their wargs in your direction. {if eaglesComing=0:They clash with your riders, swords flashing. A few of Faramir&#39;s men are pulled off their horses, but not without taking orcs with them. You continue your ride, Faramir&#39;s horses protecting yours as you go.}{if eaglesComing=1:But an eagle&#39;s cry from the sky gets their attention. Several of the rogue eagles descend on your party, but the orcs believe they are your allies and attempt to shoot them down. The eagles and orcs collide, allowing you and Faramir&#39;s men to escape their initial attack.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue289\" role=\"link\" tabindex=\"0\">You ride up Mt. Doom together.</a></p>",
		'passages': {
		},
	},
	'_continue289': {
		'text': "<p>You enter a cave and find yourselves at the edge of a fiery pit.</p>\n<p>Faramir urges you, &quot;Quick, throw it in! Destroy the Ring before it&#39;s too late!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Faramir's men watch you prepare to hurl the Ring into the lava.\" role=\"link\" tabindex=\"0\">Faramir&#39;s men watch you prepare to hurl the Ring into the lava.</a></p>",
		'passages': {
		},
	},
	'be honest already': {
		'text': "<p>You tell Faramir you were lying before, about everything. You tell him about the Ring, the Fellowship, and what happened with his brother. Faramir is horrified to discover everything, but even more disappointed that you aren&#39;t actually wizards.</p>\n<p>&quot;We could&#39;ve use that Ring at Osgiliath!&quot; he moans, very upset that you strung him along this long. &quot;But since we&#39;re here, just throw the stupid thing in the lava already. I won&#39;t be an idiot like Boromir - bless his idiot soul.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Faramir's men watch you prepare to hurl the Ring into the lava.\" role=\"link\" tabindex=\"0\">Faramir&#39;s men watch you prepare to hurl the Ring into the lava.</a></p>",
		'passages': {
		},
	},
	'Faramir\'s men watch you prepare to hurl the Ring into the lava.': {
		'text': "<p>Suddenly, the winged fellbeast soars past the volcano stack. The Witch King leaps off into the volcano and lands on the cliff edge, battle ready with his wicked mace. He stands between you and the fires.</p>\n<p>Faramir readies his sword, his men following suit.</p>\n<p>&quot;Fools, no MAN can kill me,&quot; the Witch King sneers.</p>\n<p>&quot;Then ready yourself, for we are not MAN... we&#39;re MEN!&quot; Faramir says as they attack. &quot;PLURAL!&quot;</p>\n<p>You watch as the soldiers clash with the Witch King. He easily parries their attacks and crushes a few of their heads. Faramir gets wounded, but stays in the fight.</p>\n<p>&quot;<a class=\"squiffy-link link-section\" data-section=\"Throw the Ring quickly\" role=\"link\" tabindex=\"0\">Throw the Ring quickly</a>,&quot; Sam says. &quot;We can&#39;t <a class=\"squiffy-link link-section\" data-section=\"help Faramir now\" role=\"link\" tabindex=\"0\">help Faramir now</a>.&quot;</p>",
		'passages': {
		},
	},
	'help Faramir now': {
		'text': "<p>You foolishly dive into the fray and get hit in the face by Faramir&#39;s back-swing by accident. You take a stupid prat-fall and land at the Witch King&#39;s feet.</p>\n<p>The Witch King reaches down and rips the Ring from the chain around your neck.</p>\n<p>&quot;Leave him be!&quot; Faramir cries as he tackles the Witch King. Both of them fall from the cliff together, plunging into the lava below.</p>\n<p>Both men and the Ring are DESTROYED.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and Faramir's remaining men flee.\" role=\"link\" tabindex=\"0\">The volcano erupts and Faramir&#39;s remaining men flee.</a></p>",
		'passages': {
		},
	},
	'Throw the Ring quickly': {
		'text': "<p>You throw the Ring, but the Witch King reaches out and catches it, LIKE A BOSS.</p>\n<p>&quot;No!&quot; Faramir shouts as he lunges towards him. Off-balance, the Witch King is pushed off the cliff, taking Faramir with him.</p>\n<p>He and Faramir fall into the lava, destroying the Ring together.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"The volcano erupts and Faramir's remaining men flee.\" role=\"link\" tabindex=\"0\">The volcano erupts and Faramir&#39;s remaining men flee.</a></p>",
		'passages': {
		},
	},
	'The volcano erupts and Faramir\'s remaining men flee.': {
		'text': "<p>They take you with them as they ride their horses back down the hill. Mordor is destroyed around you by the exploding volcano. Rocks and lava crash down around you, obliterating orc camps and crushing Sauron&#39;s tower.</p>\n<p>You race through the old pass, back into the mountains, a wall of volcanic smoke at your feet. The lands of Mordor are engulfed in fire and ash.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue290\" role=\"link\" tabindex=\"0\">You all return to Gondor and are taken to Minas Tirith.</a></p>",
		'passages': {
		},
	},
	'_continue290': {
		'text': "<p>It&#39;s a day of grieving in the White City. Even though the forces of Mordor have been destroyed, King Denethor orders no one to celebrate while you are here. His son, Boromir, was slain by orcs after attacking you. His other, Faramir, died on Mt. Doom protecting you. King Denethor is not exactly pleased with you at all and confines you to a room until the Fellowship comes to pick you up.</p>\n<p>Gandalf arrives{if gandalfDead=1:, having survived his fall in Moria,} with the Fellowship and takes you and Sam away. As you leave, Minas Tirith is then ordered to celebrate. Denethor did that just so you don&#39;t get any cake.</p>\n<p>Gandalf tells you that while you were out, they defeated Saruman&#39;s army. Good for them!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue291\" role=\"link\" tabindex=\"0\">You and Sam are taken back to the Shire.</a></p>",
		'passages': {
		},
	},
	'_continue291': {
		'text': "<p>History doesn&#39;t look kindly on you after the fact. Denethor orders bards to go around singing the praises of Boromir and Faramir, the true saviours of Middle-Earth who died because of an annoying hobbit named Frodo. You are known outside the Shire as &#39;Frodo the Terrible&#39;, because neither Boromir or Faramir survived to vouch for you. Denethor makes sure the Fellowship aren&#39;t regarded warmly either, so your whole mission gets rewritten by the royals.</p>\n<p>&quot;Don&#39;t worry, Mr. Frodo, I still like you!&quot; Sam calls from your garden.</p>\n<p>And you like him too. It doesn&#39;t matter what the rest of Middle-Earth thinks. The real treasure of this journey was friendship all along.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'You follow Gollum towards the cliffs and he reveals a hidden staircase leading up into the mountains.': {
		'text': "<p>In the coming hours, Gollum grows more distant as he leads you higher into the mountains. Soon, you arrive near the top of the secret stairs.</p>\n<p>&quot;I have a bad feeling about this, Mr. Frodo,&quot; Sam says.</p>\n<p>&quot;This way! This way!&quot; Gollum laughs as he disappears into a dark cave full of spider webs.</p>\n<p>&quot;Let&#39;s <a class=\"squiffy-link link-section\" data-section=\"climb back down and forget this\" role=\"link\" tabindex=\"0\">climb back down and forget this</a>,&quot; Sam insists. &quot;Unless you actually WANT to <a class=\"squiffy-link link-section\" data-section=\"follow him into the spooky cave\" role=\"link\" tabindex=\"0\">follow him into the spooky cave</a>.&quot;</p>",
		'passages': {
		},
	},
	'climb back down and forget this': {
		'text': "<p>You decide to climb back down. Gollum comes back out.</p>\n<p>&quot;Where are you going?!&quot; he asks.</p>\n<p>You tell Gollum you don&#39;t want to go in the scary cave. It&#39;s probably full of spiders. You&#39;d rather <a class=\"squiffy-link link-section\" data-section=\"take your chances with the orcs\" role=\"link\" tabindex=\"0\">take your chances with the orcs</a> downstairs. </p>\n<p>He begs you one last time, &quot;Please! <a class=\"squiffy-link link-section\" data-section=\"Go into the cave!\" role=\"link\" tabindex=\"0\">Go into the cave!</a> We promises no giant spiders in there!&quot;</p>",
		'passages': {
		},
	},
	'take your chances with the orcs': {
		'text': "<p>You keep climbing down. Eventually, Gollum joins you. You all climb back down to the citadel and wonder how else you&#39;ll get around it.</p>\n<p>Gollum seems more frustrated than usual. He keeps muttering to himself about how a spider will be disappointed.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You hear an overhead screech.\" role=\"link\" tabindex=\"0\">You hear an overhead screech.</a></p>",
		'passages': {
		},
	},
	'Go into the cave!': {
		'text': "<p>You shrug and tell Sam maybe you should <a class=\"squiffy-link link-section\" data-section=\"follow him into the spooky cave\" role=\"link\" tabindex=\"0\">follow him into the spooky cave</a> anyway.</p>\n<p>What could go wrong?</p>",
		'passages': {
		},
	},
	'follow him into the spooky cave': {
		'text': "<p>The darkness of the cave chills you to the core. It smells like death inside, and the ground is littered with bones.</p>\n<p>You call for Gollum. He calls back, &quot;If you gets lost, don&#39;t worries! SHELOB will finds you! A-ha-ha-ha!&quot;</p>\n<p>&quot;I have an even worse feeling about this, Mr. Frodo,&quot; Sam says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue292\" role=\"link\" tabindex=\"0\">You hear loud scuttling creeping towards you.</a></p>",
		'passages': {
		},
	},
	'_continue292': {
		'text': "<p>You decide to retrace your steps back through the cave, but immediately take a wrong turn and get separated from Sam. You stumble into a giant spider&#39;s web. </p>\n<p>Cutting yourself free takes only a moment, but it&#39;s a moment too long.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue293\" role=\"link\" tabindex=\"0\">A large creature is quickly upon you.</a></p>",
		'passages': {
		},
	},
	'_continue293': {
		'text': "<p>It&#39;s the size of a cave troll, with eight legs to match. Its arachnid eyes glitter at you in the darkness and its hairy appendages clamber towards you. She is SHELOB, Queen of the Spiders.</p>\n<p>You can&#39;t outrun her. You can&#39;t outfight her. Not in this darkness. You scrounge in your pockets for something to help and discover the <a class=\"squiffy-link link-section\" data-section=\"Light of Galadriel.\" role=\"link\" tabindex=\"0\">Light of Galadriel.</a>{if hasSeed=1: You also find <a class=\"squiffy-link link-section\" data-section=\"the seed\" role=\"link\" tabindex=\"0\">the seed</a> she gave you and wonder which would be better to use.}</p>",
		'passages': {
		},
	},
	'the seed': {
		'text': "<p>You throw the tiny seed at Shelob. It bounces off the monster harmlessly and falls into the bones below. </p>\n<p>And then Shelob takes pause, bewildered at something happening beneath her. The bones rattle and Shelob carefully starts to back off. But she won&#39;t be able to run fast enough. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue294\" role=\"link\" tabindex=\"0\">And neither will you.</a></p>",
		'passages': {
		},
	},
	'_continue294': {
		'text': "<p>The seed explodes into a flood of ever-growing vines. They wash around you and Shelob and push you both through the caves. The cavern walls fill with green vines, which continue to grow and grow, pressing against the stone and cracking the unstable ground.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue295\" role=\"link\" tabindex=\"0\">The floor below you collapses.</a></p>",
		'passages': {
		},
	},
	'_continue295': {
		'text': "<p>You find yourself falling down a long incline, riding a wave of vines into deeper and deeper darkness, beyond the depths of Shelob&#39;s lair.</p>\n<p>Whatever&#39;s happening, Gollum didn&#39;t plan for this. Nobody could have. You&#39;re descending into an ancient part of Middle-Earth and about to awaken something long-forgotten.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue296\" role=\"link\" tabindex=\"0\">You finally stop falling.</a></p>",
		'passages': {
		},
	},
	'_continue296': {
		'text': "<p>You&#39;re in a massive cave, lit with lava flows. The vines behind you finally stop growing and you crawl out of them into the new cavern you&#39;ve entered.</p>\n<p>Looking around, you see the body of Shelob lying close by. She&#39;s been crushed by the cave-in. You breathe a sigh of relief that you won&#39;t have to deal with a giant spider anymore.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue297\" role=\"link\" tabindex=\"0\">And then another giant spider shows up.</a></p>",
		'passages': {
		},
	},
	'_continue297': {
		'text': "<p>Suddenly, you wish you had taken your chances with Shelob. This new spider is almost the size of this whole cave. The cave shakes with every step of its eight legs, and it looks like an entire forest as it marches towards you.</p>\n<p>You hear a deep, resounding voice in your head speak, &quot;I AM UNGOLIANT. WHAT HAVE YOU DONE... WITH MY DAUGHTER?&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You stand your ground against the enormous spider.\" role=\"link\" tabindex=\"0\">You stand your ground against the enormous spider.</a></p>",
		'passages': {
		},
	},
	'Light of Galadriel.': {
		'text': "<p>You uncap the phial. Bright light emits from the nozzle and Shelob immediately backs offs. Her confusion gives you time to run.</p>\n<p>Using the Light, you find your way through the cave. All the while, you hear Gollum singing, &quot;When she eats you, she&#39;ll eats the Precious! And when she passes your bones, the Precious will be ours!&quot;</p>\n<p>Gollum&#39;s kind of a jerk right now.</p>\n<p>As you run, you feel the Ring&#39;s voice in your head again. It wants you to <a class=\"squiffy-link link-passage\" data-passage=\"take comfort in it.\" role=\"link\" tabindex=\"0\">take comfort in it.</a> It wants you to <a class=\"squiffy-link link-section\" data-section=\"wear it again.\" role=\"link\" tabindex=\"0\">wear it again.</a></p>",
		'passages': {
			'take comfort in it.': {
				'text': "<p>You hold the Ring in your hand and take comfort that it&#39;s here for you. Nothing else matters. Your head feels dizzy.</p>",
				'attributes': ["precious+=1"],
			},
		},
	},
	'wear it again.': {
		'text': "<p>You slip on the Ring and the whole world spins around. This is really taking the edge off and making you forget you&#39;re being chased by a giant spider. You wonder if spiders can sense you when you&#39;re invisible?</p>\n<p>You slow to a crawl and realize you need a strategy. </p>\n<p>You stumble upon the skeleton of a knight. Clutched in his hand is an enchanted broadsword engraved &quot;Aragore; the Spider-Slayer&quot;. </p>\n<p>Next to him is the skeleton of a wizard, holding a glowing vial of potion labelled &quot;Screaming Death of All Spiders&quot;. </p>\n<p>Next to both of them is a dead dwarf holding a small iron box with a red button upon it marked: &quot;PRESS HERE TO KILL SPIDER&quot;.</p>\n<p>You wonder... is now a good time to <a class=\"squiffy-link link-section\" data-section=\"admire the Ring's craftmanship\" role=\"link\" tabindex=\"0\">admire the Ring&#39;s craftmanship</a> or <a class=\"squiffy-link link-section\" data-section=\"massage it fondly?\" role=\"link\" tabindex=\"0\">massage it fondly?</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'admire the Ring\'s craftmanship': {
		'text': "<p>You&#39;re certain you&#39;ve done this before, but now&#39;s as good a time as any. You admire all the work that went into this Ring and appreciate the fine detail in the lettering. It makes you happy.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You try to remember if there was something important you should be doing.\" role=\"link\" tabindex=\"0\">You try to remember if there was something important you should be doing.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'massage it fondly?': {
		'text': "<p>You fondly massage the Ring with two fingers and give it a fine polish. This is such a good idea, you&#39;re surprised you&#39;ve waited this long to show the Ring how much you love it.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You try to remember if there was something important you should be doing.\" role=\"link\" tabindex=\"0\">You try to remember if there was something important you should be doing.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'You try to remember if there was something important you should be doing.': {
		'text': "<p>You suddenly get bitten by a giant spider and dragged out of the cave. As the venom&#39;s paralysis sets in, Shelobs begins wrapping you up in spider silk.</p>\n<p>Terrified and paralyzed, you hold onto the Ring and pray it&#39;ll save you. It is super-powerful after all and will protect you against anything - even giant spiders, supposedly.</p>\n<p>The Ring does nothing. Maybe you should <a class=\"squiffy-link link-section\" data-section=\"pray the Ring saves you even harder.\" role=\"link\" tabindex=\"0\">pray the Ring saves you even harder.</a></p>",
		'passages': {
		},
	},
	'pray the Ring saves you even harder.': {
		'text': "<p>For reasons unknown, praying to the Ring does nothing against the giant spider that has you in its web. The Ring only whispers to you that everything will be okay. It promises you will be unstoppable.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue298\" role=\"link\" tabindex=\"0\">The world turns dark and you belong to Shelob.</a></p>",
		'passages': {
		},
	},
	'_continue298': {
		'text': "<p>In your darkness, <a class=\"squiffy-link link-section\" data-section=\"you imagine Sam's voice shouting out to you.\" role=\"link\" tabindex=\"0\">you imagine Sam&#39;s voice shouting out to you.</a></p>",
		'passages': {
		},
	},
	'you imagine Sam\'s voice shouting out to you.': {
		'text': "<p>Hours of empty horror pass. Your mind is lost in a waking nightmare as you are tossed and dragged around. First you hear the screams of a spider, then the growls of Orcs. There are sounds of swordplay and bloodshed. The places you are taken to smell rancid and unloved. </p>\n<p>All the while, the Ring continues to keep you sedated. So much is happpening outside your body and you are oblivious to it all.</p>\n<p>Soon, your senses calm, and you find yourself in another cave. This one is cleaner and warmer than the last. You lay on a soft blanket, no longer covered in web.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue299\" role=\"link\" tabindex=\"0\">You see Sam preparing you a meal over a fire.</a></p>",
		'passages': {
		},
	},
	'_continue299': {
		'text': "<p>&quot;You&#39;re finally awake,&quot; he says. &quot;I&#39;ve had quite an adventure fighting off spiders and Orcs alike to bring here you here.&quot;</p>\n<p>He continues to tell you that he fought off Shelob, rescued you from a troop of Orcs, carried you miles past Cirith Ungol to finally arrive at the foot of Mt. Doom.</p>\n<p>Outside the cave, you see the raging volcano in the distance. Between it and you are miles of Orc camps.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue300\" role=\"link\" tabindex=\"0\">You immediately demand to know where your Ring is.</a></p>",
		'passages': {
		},
	},
	'_continue300': {
		'text': "<p>Sam hands it to you. You snatch the Ring from his hand and love it tenderly.</p>\n<p>After you&#39;ve both eaten, Sam says, &quot;I took the liberty of borrowing some Orc armour from the citadel. We can <a class=\"squiffy-link link-section\" data-section=\"sneak to Mt. Doom in disguise\" role=\"link\" tabindex=\"0\">sneak to Mt. Doom in disguise</a> or <a class=\"squiffy-link link-section\" data-section=\"we can wait for the Orc army to leave.\" role=\"link\" tabindex=\"0\">we can wait for the Orc army to leave.</a> Your choice.&quot;</p>",
		'passages': {
		},
	},
	'sneak to Mt. Doom in disguise': {
		'text': "<p>You tell Sam we&#39;ll go now. You both dress in Orc armour and head off across the field towards the volcano.</p>\n<p>As you wander through one of the camps, you&#39;re afraid your short stature might draw some attention, but it seems the orcs don&#39;t discriminate against height. It&#39;s actually your lack of smell that gets their attention. Two orcs approach you.</p>\n<p>&quot;Oi, you two don&#39;t smell like orcs,&quot; one says, &quot;Where&#39;s-abouts dids ya come from?&quot;</p>\n<p>You try to <a class=\"squiffy-link link-section\" data-section=\"come up with a story\" role=\"link\" tabindex=\"0\">come up with a story</a> to please them. Sam&#39;s ready to <a class=\"squiffy-link link-section\" data-section=\"fight out of here\" role=\"link\" tabindex=\"0\">fight out of here</a> if needed.</p>",
		'passages': {
		},
	},
	'come up with a story': {
		'text': "<p>Because you&#39;re a terrible liar, you tell him that you and Sam are conscripted body wash distributors, ordered to deliver soap and body lotions among the troops. Sauron would like his men smelling their best for the upcoming war.</p>\n<p>&quot;A likely story,&quot; one orc sneers. &quot;Why would Sauron care about our smell? He&#39;s a giant flaming eye, not a giant flaming nose! So where&#39;s this soap of yours?&quot;</p>\n<p>{if hasShampoo=1:Sam remembers your welcome gifts from Lothlorien, and whispers, &quot;Mr. Frodo, quick, <a class=\"squiffy-link link-section\" data-section=\"give them your shampoo\" role=\"link\" tabindex=\"0\">give them your shampoo</a>!&quot;}</p>\n<p>{if hasShampoo=0:You didn&#39;t plan this far ahead, so you <a class=\"squiffy-link link-section\" data-section=\"consider a better lie\" role=\"link\" tabindex=\"0\">consider a better lie</a>, unless you want to <a class=\"squiffy-link link-section\" data-section=\"fight out of here\" role=\"link\" tabindex=\"0\">fight out of here</a>.}</p>",
		'passages': {
		},
	},
	'consider a better lie': {
		'text': "<p>You tell them you actually just had a bath to wash off the blood of the last two orcs who gave you a hard time. You bare your teeth and perform a territorial dance to display dominance. Sam growls at them.</p>\n<p>They respond in kind by growling and stomping their feet. Looks like you might have to <a class=\"squiffy-link link-section\" data-section=\"fight out of here\" role=\"link\" tabindex=\"0\">fight out of here</a> if you can&#39;t <a class=\"squiffy-link link-section\" data-section=\"out-orc the orcs\" role=\"link\" tabindex=\"0\">out-orc the orcs</a>.</p>",
		'passages': {
		},
	},
	'out-orc the orcs': {
		'text': "<p>You decide to roll for intimidation and get a natural 20.</p>\n<p>You and Sam belly-slam one another, perform a synchronized chest beating, and spit in each other&#39;s faces. Then, for a flourish, you grab burning sticks from a nearby campfire and blind the orcs with them. They scream in pain.</p>\n<p>&quot;Oi, okay, okay - you win!&quot; they cry.</p>\n<p>&quot;Anybody else want some?&quot; Sam shouts. All the other orcs give you space. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue301\" role=\"link\" tabindex=\"0\">You and Sam continue unhindered through the camp.</a></p>",
		'passages': {
		},
	},
	'_continue301': {
		'text': "<p>That worked out surprisingly well.</p>\n<p>Eventually, you and Sam cross the Mordor wasteland and arrive at the bottom of the mountain where you ditch the costumes.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'give them your shampoo': {
		'text': "<p>You offer them your elven shampoo and order them to go wash up. They reluctantly take it and leave you alone to go wash, rinse, and repeat.</p>\n<p>All the other orcs give you space as you walk through the camp. They don&#39;t want to take baths, so you and Sam are able to pass through the wastelands safely and get to Mt. Doom without incident.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'fight out of here': {
		'text': "<p>You give up the disguise and lunge at the orcs, sword-first. You miss, but Sam delivers by striking both with his frying pan.</p>\n<p>&quot;Run!&quot; he shouts. You abandon your heavy armour and scurry through the camp with the orcs on your tail.</p>\n<p>{if hasBrightMail=0:It&#39;s total chaos as you knock over torches and cut through tents. Sam&#39;s frying pan works overtime as he strikes down every orc in your path. The two orcs you met shout, &quot;Intruders! We&#39;ve got intruders over here!&quot;}</p>\n<p>{if hasBrightMail=0:&quot;This is it!&quot; Sam cries, &quot;We&#39;re gonna die! We&#39;re gonna die!&quot;}</p>\n<p>{if hasBrightMail=0:<a class=\"squiffy-link link-section\" data-section=\"You're chased from the camp and hurry towards Mt. Doom.\" role=\"link\" tabindex=\"0\">You&#39;re chased from the camp and hurry towards Mt. Doom.</a>}</p>\n<p>{if hasBrightMail=1:As you run, your +2 bright mail blinds any extra orcs you pass, giving you a chance to slip through unnoticed. You suddenly feel very lucky that you refused Bilbo&#39;s gift and got stabbed in Moria. This new armour is ten times more useful here.}</p>\n<p>{if hasBrightMail=1:Your elven mail gets you and Sam through the camp without drawing further attention. You even lose the other two orcs and successfully get to Mt. Doom without further incident.}</p>\n<p>{if hasBrightMail=1:<a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a>}</p>",
		'passages': {
		},
	},
	'You\'re chased from the camp and hurry towards Mt. Doom.': {
		'text': "<p>Your tired feet can&#39;t run any further. At some point, you need to <a class=\"squiffy-link link-section\" data-section=\"face your attackers head-on\" role=\"link\" tabindex=\"0\">face your attackers head-on</a>. But you could also <a class=\"squiffy-link link-section\" data-section=\"use the Ring to escape them\" role=\"link\" tabindex=\"0\">use the Ring to escape them</a> as well, abandoning Sam to your pursuers.</p>",
		'passages': {
		},
	},
	'face your attackers head-on': {
		'text': "<p>So it&#39;s now or never. You and Sam turn to face the pursuing army.</p>\n<p>The same two orcs you met earlier are the only ones chasing you. Sam quickly strikes them down with his frying pan again, and then beats them repeatedly until they stop getting up.</p>\n<p>No one else is chasing you. It just was these two. It seems like even you though you got the attention of the whole camp, the army didn&#39;t bother chasing you because they thought these two orcs had it covered. </p>\n<p>So now you&#39;ve made to the mountain without getting captured! Nice job!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'use the Ring to escape them': {
		'text': "<p>You slip the Ring on and vanish, hurrying along while leaving Sam behind.</p>\n<p>&quot;Frodo! Get back here!&quot; Sam begs. &quot;Don&#39;t leave me!&quot;</p>\n<p>You hide behind some rocks and wait for the orcs to have their way with Sam, like the monster you are. Sure enough, there&#39;s the sounds of a scuffle, and then silence among the orcs.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue302\" role=\"link\" tabindex=\"0\">You take off the Ring and come out of hiding.</a></p>",
		'attributes': ["precious+=1"],
		'passages': {
		},
	},
	'_continue302': {
		'text': "<p>Sam hits you with a frying pan.</p>\n<p>&quot;You jerk! You left me to die!&quot; he shouts. &quot;I had to fight them off myself!&quot;</p>\n<p>You apologize profusely, but Sam hits you a few more times until he feels better about your inevitable betrayal. He didn&#39;t sign up for this when you hired him as gardener.</p>\n<p>Eventually, he gets tired of being angry at you and refocuses on the mountain.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'we can wait for the Orc army to leave.': {
		'text': "<p>You decide to wait out in the cave and hope the Orc camps will soon clear out. Sure enough, after a day, you see them march off towards the Black Gate for their final assault on Minas Tirith.</p>\n<p>You and Sam easily get through the camps without getting caught.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You stand your ground against the enormous spider.': {
		'text': "<p>As you do, your hand creeps up towards your Ring -- only to discover it&#39;s missing. Several feet away, towards the spider, you see your Ring lying on the ground. The spider sees it too and quickly puts a foot over it.</p>\n<p>&quot;NO DISAPPEARING, LITTLE ONE,&quot; it growls.</p>\n<p>Out the corner of your eye, you see Sam emerge from the rubble beside Ungoliant. You hope she hasn&#39;t noticed them there yet. Sam stays quiet and waits for your move.</p>\n<p>You suppose you could <a class=\"squiffy-link link-section\" data-section=\"try talking to the spider\" role=\"link\" tabindex=\"0\">try talking to the spider</a>, but maybe you can <a class=\"squiffy-link link-section\" data-section=\"chance your way past its huge legs\" role=\"link\" tabindex=\"0\">chance your way past its huge legs</a>.</p>\n<p>{if gandalfDead=0:(The cave starts to smell funny.)}</p>",
		'passages': {
		},
	},
	'try talking to the spider': {
		'text': "<p>You introduce yourself as Frobag Samgee because you&#39;re super-nervous. You wonder if this is how Uncle Bilbo felt when he first faced Smaug. You apologize for the intrusion and let Ungoliant know that you will show yourself out.</p>\n<p>She orders an army of spiders to cover the hole you fell in from with webs, blocking your exit.</p>\n<p>&quot;IT&#39;S BEEN A LONG TIME SINCE I HAD VISITORS,&quot; she says. &quot;EVEN SHELOB NEVER VISITS ME ANYMORE. YOU SIMPLY MUST <a class=\"squiffy-link link-section\" data-section=\"STAY AND TELL ME HOW SHE DIED\" role=\"link\" tabindex=\"0\">STAY AND TELL ME HOW SHE DIED</a>. OR WOULD YOU PERHAPS RATHER <a class=\"squiffy-link link-section\" data-section=\"TELL ME WHERE YOU FOUND THIS RING\" role=\"link\" tabindex=\"0\">TELL ME WHERE YOU FOUND THIS RING</a>?&quot;</p>",
		'passages': {
		},
	},
	'STAY AND TELL ME HOW SHE DIED': {
		'text': "<p>You tell Ungoliant that you were passing through Shelob&#39;s cave by mistake, and it caved in while Shelob was giving you directions to Mordor. You had nothing to do with any of it.</p>\n<p>&quot;HER DEATH IS UNTIMELY, BUT OF NO IMPORTANCE,&quot; Ungoliant says. &quot;SURELY, SHE WILL BE REBORN IN THE COMING AGES, FAR MORE TERRIBLE AND WORTHY OF HER MOTHER&#39;S LOVE. YOU ON THE OTHER HAND...&quot;</p>\n<p>{if gandalfDead=0:<a class=\"squiffy-link link-section\" data-section=\"Ungoliant starts to stagger.\" role=\"link\" tabindex=\"0\">Ungoliant starts to stagger.</a>}\n{if gandalfDead=1:<a class=\"squiffy-link link-section\" data-section=\"Ungoliant summons an army of spiders to surround you.\" role=\"link\" tabindex=\"0\">Ungoliant summons an army of spiders to surround you.</a>}</p>",
		'passages': {
		},
	},
	'TELL ME WHERE YOU FOUND THIS RING': {
		'text': "<p>You tell her the Ring&#39;s an old family keepsake. It&#39;s a fake Ring of Power, modeled after the One Ring and infused with your Uncle Dudo&#39;s soul to give it that authentic &#39;Dark Lord&#39; smell. You politely request its return.</p>\n<p>&quot;TRUE RING OR NOT, POWER OF THIS WEIGHT DOES NOT COME BY EASILY,&quot; she says. &quot;TO THE ANCIENT ONES, ITS SCENT IS SWEET AND CRAVED. ONE SUCH AS MYSELF COULD SUSTAIN THEMSELF IN ITS PRESENCE FOR EONS TO COME. BUT YOU, ON THE OTHER HAND...&quot;</p>\n<p>{if gandalfDead=0:<a class=\"squiffy-link link-section\" data-section=\"Ungoliant starts to stagger.\" role=\"link\" tabindex=\"0\">Ungoliant starts to stagger.</a>}\n{if gandalfDead=1:<a class=\"squiffy-link link-section\" data-section=\"Ungoliant summons an army of spiders to surround you.\" role=\"link\" tabindex=\"0\">Ungoliant summons an army of spiders to surround you.</a>}</p>",
		'passages': {
		},
	},
	'Ungoliant starts to stagger.': {
		'text': "<p>&quot;HEH, HEH...&quot; she chuckles. You&#39;re feeling it too. That funny smell is suddenly kind of nice. Almost like... some of Gandalf&#39;s... pipe-weed.</p>\n<p>You see Sam smirking at his hands.</p>\n<p>&quot;SORRY... WHAT WAS I SAYING?&quot; Ungoliant asks. &quot;MAN... THESE VINES YOU BROUGHT DOWN WITH YOU... WHAT&#39;S IN THEM? THAT PILE ON THE LAVA OVER THERE REEKS SOMETHING NICE, YA KNOW? SHOULD CRACK A WINDOW, MAYBE...&quot;</p>\n<p>You remember Galadriel warning you that she and Gandalf might have done something to that seed she gave you. You start to feel a little like Gandalf yourself.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You notice your hands keep changing colour.\" role=\"link\" tabindex=\"0\">You notice your hands keep changing colour.</a></p>",
		'passages': {
		},
	},
	'Ungoliant summons an army of spiders to surround you.': {
		'text': "<p>&quot;TELL ME WHY YOU&#39;RE MORE THAN JUST A MEAL FOR THE REST OF MY CHILDREN.&quot;</p>\n<p>As you&#39;re talking, you Sam see climb the cave walls to a ledge. He approaches a large stone pillar towering over Ungoliant&#39;s head.</p>\n<p>You need to <a class=\"squiffy-link link-section\" data-section=\"stall for more time\" role=\"link\" tabindex=\"0\">stall for more time</a>. You don&#39;t think you can <a class=\"squiffy-link link-section\" data-section=\"step on all these spiders\" role=\"link\" tabindex=\"0\">step on all these spiders</a>.</p>",
		'passages': {
		},
	},
	'stall for more time': {
		'text': "<p>You tell Ungoliant that you would be an excellent meal for her children because you&#39;re had your vaccination shots, went to a Montesorri school, and eat plenty of kale. You hope one of those is a trigger for her.</p>\n<p>&quot;KALE?! WHY IS EVERYONE SO HUNG UP ON KALE?&quot; she asks. &quot;IT DOESN&#39;T TASTE LIKE ANYTHING. IT&#39;S LIKE SAND IN YOUR MOUTH. PEOPLE ARE LIKE, &#39;OH, DO YOU WANT TO GO OUT FOR A KALE SALAD?&#39; AND I&#39;M LIKE &#39;NO! I WANT TO GO FOR A REAL SALAD! WITH LETTUCE! OR SPINACH! I DON&#39;T NEED TO EAT SAND TO GET ALL OF ITS BENEFITS!&quot;</p>\n<p>As she rants, <a class=\"squiffy-link link-section\" data-section=\"Sam pushes over the stone pillar.\" role=\"link\" tabindex=\"0\">Sam pushes over the stone pillar.</a></p>",
		'passages': {
		},
	},
	'step on all these spiders': {
		'text': "<p>But you try anyway.</p>\n<p>Ungoliant is shocked and horrified as you stamp your feet into the hordes of tiny spiders around you. The spiders themselves scatter in terror, not even trying to attack you, making it very easy to step on the rest. Within half a minute, you defeat the army of spiders.</p>\n<p>Ungoliant stomps her enormous legs. &quot;MY CHILDREN! YOU&#39;LL PAY FOR THAT, FLESHLING!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Sam pushes over the stone pillar.\" role=\"link\" tabindex=\"0\">Sam pushes over the stone pillar.</a></p>",
		'passages': {
		},
	},
	'Sam pushes over the stone pillar.': {
		'text': "<p>You expect it to crush Ungoliant, but it seems Sam had another target. He pushes it into a pool of lava near her face. The splash on her face repels her. While she&#39;s resistant to its heat, she struggles to shake the molten substance from her face. Backing up, she reveals the Ring.</p>\n<p>&quot;Run!&quot; Sam shouts.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue303\" role=\"link\" tabindex=\"0\">You dart forward, grab the Ring, and rush through her legs.</a></p>",
		'passages': {
		},
	},
	'_continue303': {
		'text': "<p>Her legs crash down around you as you run beneath her. She rams against the walls in a panic, screaming for your blood as she wipes away the lava. Sam races across the ledge above, shouting &quot;There&#39;s an exit ahead! Keep going!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You make your way past Ungoliant.\" role=\"link\" tabindex=\"0\">You make your way past Ungoliant.</a></p>",
		'passages': {
		},
	},
	'chance your way past its huge legs': {
		'text': "<p>You run towards her. She did not expect this.</p>\n<p>She tries to step on you, but you&#39;re too fast and nimble for her over-sized limbs. {if hasBrightMail=1:Plus, the glint from your +2 bright mail is blinding her as you run.}</p>\n<p>This seems like a good plan until Ungoliant gets her bearings and turns to trample you. That&#39;s when Sam dives off a nearby ledge onto her back and starts stabbing her.</p>\n<p>&quot;<a class=\"squiffy-link link-section\" data-section=\"Run to the exit without me\" role=\"link\" tabindex=\"0\">Run to the exit without me</a>, Mr. Frodo!&quot; he shouts. &quot;Don&#39;t <a class=\"squiffy-link link-section\" data-section=\"worry about me\" role=\"link\" tabindex=\"0\">worry about me</a>!&quot;</p>",
		'passages': {
		},
	},
	'Run to the exit without me': {
		'text': "<p>You abandon Sam like the terrible hobbit you are. Behind you, you hear the raucous of a rampaging spider and the screams of your best friend. </p>\n<p>The cave walls start caving in amid the chaos and you are certain Sam is DEAD. But you will not let his sacrifice be in vain. You will honour his death by destroying the Ring and... </p>\n<p>Oh-no! You forgot the Ring!</p>\n<p>Suddenly, Sam runs past and tosses you the Ring. It seems whatever happened back there, he lived.</p>\n<p>&quot;Spider&#39;s still coming!&quot; he shouts as he hustles to the exit.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You make your way past Ungoliant.\" role=\"link\" tabindex=\"0\">You make your way past Ungoliant.</a></p>",
		'passages': {
		},
	},
	'worry about me': {
		'text': "<p>You stare at Sam battling the giant spider, your mouth agape like an idiot. You are SO worried about him.</p>\n<p>&quot;Just run! What are you waiting for?!&quot; he shouts as he rodeos that spider throughout the cave. Ungoliant smashes into the walls and splashes through lava pools, causing the cave ceiling to come down. Sam clings onto her spider hairs throughout the madness.</p>\n<p>A large stalactite comes down from the ceiling and crashes into her head. As she stumbles, Sam rolls off her head, grabs the Ring and catches up to you.</p>\n<p>&quot;Enjoy the show?&quot; he asks, tossing the Ring to you. &quot;LET&#39;S GO NOW.&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You make your way past Ungoliant.\" role=\"link\" tabindex=\"0\">You make your way past Ungoliant.</a></p>",
		'passages': {
		},
	},
	'You make your way past Ungoliant.': {
		'text': "<p>As you run, you see Gollum ahead. It appears he was in the cave-in as well and is only just regaining consciousness and climbing out of the rubble.</p>\n<p>Even though he tried to kill you, you feel you should either take the high road and <a class=\"squiffy-link link-section\" data-section=\"warn him about Ungoliant\" role=\"link\" tabindex=\"0\">warn him about Ungoliant</a>, or <a class=\"squiffy-link link-section\" data-section=\"leave him for spider food\" role=\"link\" tabindex=\"0\">leave him for spider food</a> as payback.</p>",
		'passages': {
		},
	},
	'warn him about Ungoliant': {
		'text': "<p>You run past, screaming about a giant spider.</p>\n<p>This gets Gollum&#39;s attention. He sees Ungoliant stomping towards him and chases after you.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You escape the cavern with Ungoliant in pursuit.\" role=\"link\" tabindex=\"0\">You escape the cavern with Ungoliant in pursuit.</a></p>",
		'passages': {
		},
	},
	'leave him for spider food': {
		'text': "<p>You run past and wave, leaving him confused.</p>\n<p>A moment later, Ungoliant steps on him. Gollum is now dead.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You escape the cavern with Ungoliant in pursuit.\" role=\"link\" tabindex=\"0\">You escape the cavern with Ungoliant in pursuit.</a></p>",
		'attributes': ["gollumDead = 1"],
		'passages': {
		},
	},
	'You escape the cavern with Ungoliant in pursuit.': {
		'text': "<p>Day breaks as you enter Mordor. You and Sam take refuge behind some rocks and watch as Ungoliant storms into the fields, towards some orc camps. The orcs panic and run as this unexpected monster destroys their camp.</p>\n<p>You watch Ungoliant get lost in the confusion, and she runs off to destroy another camp in search in you. </p>\n<p>&quot;Mordor&#39;s going to have a fun day with her,&quot; Sam says. He sees Mt. Doom in the distance and says, &quot;And it looks like we have a clear shot at the mountain. Let&#39;s go!&quot;</p>\n<p>{if gollumDead=0:You look around for Gollum and don&#39;t see him. He may have lost track of you. You had no desire to rejoin him, but it was nice of you to save his life.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue304\" role=\"link\" tabindex=\"0\">You head towards Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue304': {
		'text': "<p>As you go, the forces of Mordor rally against Ungoliant. She&#39;s lost interest in you, and is now only interested in fighting all these orcs that have shown up. You think with enough time and weapons, they might bring her down, but you wager she&#39;ll ruin half of Sauron&#39;s army first.</p>\n<p>{if gollumDead=0:{if gollumKnows=1:In the meantime, you worry about Gollum. Even though you&#39;re separated, he knows about your mission and where you&#39;re heading. You&#39;ll have to destroy the Ring before he finds you again.}}</p>\n<p>{if gollumDead=0:{if gollumKnows=0:As you make your way through a wrecked camp, Sam spots Gollum in the distance and ushers you into hiding. Gollum seems lost and confused, not knowing where you are or why you even came to Mordor. It seems he knows nothing about your mission, since he leaves you alone and heads off in a direction AWAY from Mt. Doom.}}</p>\n<p>{if gollumDead=0:{if gollumKnows=0:&quot;We won&#39;t be seeing him again,&quot; Sam says.}}</p>\n<p>You eventually arrive at the volcano.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You notice your hands keep changing colour.': {
		'text': "<p>And the spider has a lot more legs all of a sudden. It&#39;s like looking at a giant kaleidoscope. </p>\n<p>Also, you don&#39;t know who&#39;s playing classic rock, but you wish they&#39;d crank it up because you LOVE THIS SONG.</p>\n<p>You piece it together that the magic-infused smoke from the burning vines may be more recreational than medical. It&#39;s filling this cave quickly. Sam and Ungoliant are feeling it too.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue305\" role=\"link\" tabindex=\"0\">You suddenly feel free.</a></p>",
		'passages': {
		},
	},
	'_continue305': {
		'text': "<p>You&#39;re soaring through the sky like a cloud in the wind. You&#39;ve never felt so happy. This spider cave is the high point of your journey so far.</p>\n<p>You and Sam continue on your journey. You meet Ringo Starr and the rest of the Beatles, ride away on a Yellow Submarine, and save Pepperland from Blue Meanies.</p>\n<p>Then you push it to Warp 9 and fly to the ends of the universe. Every planet is Saturn up here. You hop in a convertible and skydive back to Earth. Sam turns up Pink Floyd on the radio. You both listen to your new favourite song.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue306\" role=\"link\" tabindex=\"0\">You spend several hours debating whether this song syncs up to &#39;Wizard of Oz&#39;.</a></p>",
		'passages': {
		},
	},
	'_continue306': {
		'text': "<p>Eventually, Sam says, &quot;Mr. Frodo... I think we&#39;re really high.&quot;</p>\n<p>You figured that out thirty bags of doritos ago.</p>\n<p>&quot;NO!&quot; he suddenly screams, &quot;WE ARE REALLY HIGH!&quot;</p>\n<p>You snap out of your magical delirium and notice you are several stories HIGH IN THE AIR, hanging off a giant spider&#39;s back! </p>\n<p>Ungoliant stomps and smashes her way through the fields of Mordor. You hang on for dear life as hundreds of orcs fire arrows and catapults at you. The giant spider tears through another camp, knocking over torches and leaving a trail of burning tents in her wake.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You reassess your situation.\" role=\"link\" tabindex=\"0\">You reassess your situation.</a></p>",
		'passages': {
		},
	},
	'You reassess your situation.': {
		'text': "<p>You don&#39;t remember how you came be on the spider&#39;s back, but it seems like Ungoliant&#39;s been smashing things for a while. Half of Mordor has been laid to waste as Ungoliant continues to rampage through their land. Oliphaunts flee in terror at the sight of this monster.</p>\n<p>You also notice you and Sam are naked.</p>\n<p>As you hang on tight, you find the Ring clutched in your hand.</p>\n<p>&quot;I don&#39;t know where our clothes are, but we need to <a class=\"squiffy-link link-section\" data-section=\"get off this spider\" role=\"link\" tabindex=\"0\">get off this spider</a>!&quot; Sam says. &quot;Unless your plan is to <a class=\"squiffy-link link-section\" data-section=\"drive this thing to Mt. Doom\" role=\"link\" tabindex=\"0\">drive this thing to Mt. Doom</a>?&quot;</p>",
		'attributes': ["nakedHobbits = 1"],
		'passages': {
		},
	},
	'get off this spider': {
		'text': "<p>Ungoliant walks over a large tent. You tell Sam to let go of the spider.</p>\n<p>You both slide off its back and fall onto the tent below. You land safely, yet naked, in the orc camp. Ungoliant continues smashing through the camp.</p>\n<p>Sam finds a sword on the ground and directs you towards Mt. Doom.</p>\n<p>&quot;Come on, Mr. Frodo!&quot; he says. &quot;Let&#39;s finish this!&quot;</p>\n<p>You and Sam run naked through the fields of Mordor until you get to the mountain. As you run, you feel the Ring coming down from its own high. It grows heavier, and you grow more weary.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You begin your ascent up Mt. Doom.\" role=\"link\" tabindex=\"0\">You begin your ascent up Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'drive this thing to Mt. Doom': {
		'text': "<p>That&#39;s sounds like a great idea! You feel focused enough to drive, so you climb up on the spider&#39;s head and start tugging on her hair.</p>\n<p>Fortunately for you, the spider is also exceptionally high, and confuses your hair-pulling for her own motor functions. As you pull right, she turns right. You go left, she turns left.</p>\n<p>She runs straights into Sauron&#39;s tower.</p>\n<p>You smash through the tower of Barad-dûr, knocking the Flaming Eye over onto Sauron&#39;s army. Ungoliant then starts her way up Mt. Doom.</p>\n<p>You ascend the mountain on the giant spider. As you cross over the main shaft, <a class=\"squiffy-link link-section\" data-section=\"you prepare to throw the Ring into the lava\" role=\"link\" tabindex=\"0\">you prepare to throw the Ring into the lava</a>.</p>",
		'passages': {
		},
	},
	'you prepare to throw the Ring into the lava': {
		'text': "<p>You launch the Ring into the volcano below. The Ring bounces off the volcano walls and lands in the lava pool where it melts.</p>\n<p>The volcano erupts, kicking Ungoliant into a paranoid freak-out. She veers sharply to the left and storms out of Mordor, smashing her way through the mountains.</p>\n<p>&quot;She&#39;s out of control!&quot; Sam cries. &quot;You have to stop this thing, Mr. Frodo!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue307\" role=\"link\" tabindex=\"0\">You hang on as she races into Rohan.</a></p>",
		'passages': {
		},
	},
	'_continue307': {
		'text': "<p>You come upon an unusual scene. An army of tree people are attacking a wizard&#39;s tower in the middle of the woods. They&#39;re quite surprised to see a giant spider smash through their battlefield. Ungoliant destroys the wizard&#39;s tower and breaks a nearby dam, flooding the area. All the trees cheer for the great spider.</p>\n<p>{if merryPippinInRohan=1:You see Merry and Pippin on one of the tree people. You wave to them. They&#39;re confused by both the spider and your nudity, wondering how the two things are connected.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue308\" role=\"link\" tabindex=\"0\">You smash further into Rohan.</a></p>",
		'passages': {
		},
	},
	'_continue308': {
		'text': "<p>A small army of horsemen ride past shooting arrows at the giant spider. </p>\n<p>You approach a mountain fortress where you see an army of men battling an army of orcs, 10,000 strong.</p>\n<p>You&#39;re delighted to see the Fellowship among them, battling for the future of Middle-Earth! {if gandalfDead=1:You see Gandalf as well, alive after his fall in Moria. He&#39;s wearing some stylish white robes.}</p>\n<p>Gimli shouts, &quot;GIANT SPIDER! RUN!&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue309\" role=\"link\" tabindex=\"0\">You crash into the fortress walls.</a></p>",
		'passages': {
		},
	},
	'_continue309': {
		'text': "<p>Fortunately, most of the soldiers that Ungoliant steps on are orcs. The fortress walls cave in on even more orcs, helping the people of Rohan win a decisive battle for Middle-Earth. Ungoliant continues her paranoia freak-out as she tramples the battlefield.</p>\n<p>Gandalf raises his staff. Light shines from its tip as he tries to ward off the spider, but his magic is powerless. He recognizes the smell of his own product on Ungoliant and knows he has no power over her.</p>\n<p>&quot;She&#39;s coming down off her high,&quot; he calls to you. &quot;Frodo! You need to get her out of here before the munchies kick in!&quot;</p>\n<p>You wonder where a giant spider can find some snacks. Lothlorien certainly had some excellent <a class=\"squiffy-link link-section\" data-section=\"lembas bread\" role=\"link\" tabindex=\"0\">lembas bread</a>, but you also heard great things about the <a class=\"squiffy-link link-section\" data-section=\"chicken wings\" role=\"link\" tabindex=\"0\">chicken wings</a> at Minas Tirith.</p>",
		'passages': {
		},
	},
	'lembas bread': {
		'text': "<p>You could go for some lembas bread and salsa right about now. You yank on the spider&#39;s hair and lead her away from the fortress towards the forests. It&#39;s easy to spot Lothlorien from this height and you&#39;re soon on your way back.</p>\n<p>Meanwhile, Lady Galadriel is just hanging out in her room playing the drums when she notices her bass drum is getting louder with every kick. She soon figures out that loud thumping isn&#39;t her drums and runs to the window.</p>\n<p>A giant spider is marching through the forests towards her city. She smells Gandalf&#39;s product on Ungoliant from this distance and knows exactly what she&#39;s up against.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue310\" role=\"link\" tabindex=\"0\">Galadriel climbs onto the roof and confronts the giant spider.</a></p>",
		'passages': {
		},
	},
	'_continue310': {
		'text': "<p>While Ungoliant goes for Lothlorien&#39;s food stores and snacks down on bread, Galadriel digs around in her robes and finds a vial of her own special stuff.</p>\n<p>She jumps across the rooftops (the way elves are oft to do), runs up the highest tree, and jumps onto the spider&#39;s back with you. She opens her vial.</p>\n<p>&quot;Is that more magic?&quot; Sam asks.</p>\n<p>&quot;No, it&#39;s nacho cheese,&quot; she says.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue311\" role=\"link\" tabindex=\"0\">She runs up to Ungoliant&#39;s head and pours the cheese onto the bread below.</a></p>",
		'passages': {
		},
	},
	'_continue311': {
		'text': "<p>Ungoliant quickly fills up on nacho bread and gets tired. Galadriel grabs you and Sam and jumps off the creature&#39;s back just as it yawns. </p>\n<p>The giant spider rolls over with a great earth-shattering thud and takes a nap. Galadriel relates so much.</p>\n<p>Off in the distance, you watch Mordor explode.</p>\n<p>Congratulations, Frodo! You&#39;ve saved Middle-Earth!</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You're given some clothes and go home.\" role=\"link\" tabindex=\"0\">You&#39;re given some clothes and go home.</a></p>",
		'passages': {
		},
	},
	'chicken wings': {
		'text': "<p>You could go for some chicken wings. You yank on the spider&#39;s hair and direct her towards the great white city of Minas Tirith in the far-off distance (you can easily see it from this height). You leave the fortress and cross over valleys and mountains towards the city&#39;s famous chicken wings.</p>\n<p>Meanwhile, King Denethor sits in his dining hall chewing on some delicious barbecue wings and dipping them in ranch dressing. </p>\n<p>Suddenly, the walls start shaking. He summons his guards and runs to the city&#39;s ramparts. Across the fields of Pelennor, he sees you and naked Sam racing towards their beautiful city on a giant spider.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue312\" role=\"link\" tabindex=\"0\">The full fury of the city attacks!</a></p>",
		'passages': {
		},
	},
	'_continue312': {
		'text': "<p>Catapults fires flurries of flaming cannonballs towards your position!</p>\n<p>Ungoliant shrugs off their attacks, desperate to get to those finger-lickin&#39; wings. Denethor runs screaming from the ramparts as Ungoliant climbs the city walls, smashing the catapults and ascends to the throne room.</p>\n<p>She smashes her head into the dining room and feasts upon Denethor&#39;s dinner. You and Sam sneak off her back before you&#39;re seen by the guards.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue313\" role=\"link\" tabindex=\"0\">King Denethor orders more food.</a></p>",
		'passages': {
		},
	},
	'_continue313': {
		'text': "<p>The city chefs work overtime to feed the giant spider waves after waves of late-night snacks. After chicken wings, the spider craves brunch, so Denethor orders up some honey cake french toast, hearty breakfast sausage and sweet potato pecan pancakes.</p>\n<p>Around 4 in the morning, Ungoliant finishes her meal with a pumpkin pie milk shake, rolls over and goes to sleep.</p>\n<p>Off in the distance, Mordor explodes. Middle-Earth is saved, thanks to King Denny&#39;s limited-time &quot;Desolation of Smaug&quot; Hobbit menu.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You're given some clothes and go home.\" role=\"link\" tabindex=\"0\">You&#39;re given some clothes and go home.</a></p>",
		'passages': {
		},
	},
	'You\'re given some clothes and go home.': {
		'text': "<p>The rest of the Fellowship eventually disbands and goes their own ways. {if merryPippinInRohan=1:Gandalf makes sure Merry and Pippin get home all right.}</p>\n<p>You and Sam retire back to Hobbiton and seldom speak of that time you got a giant spider really high and trampled half of Middle-Earth in the nude. It was a fun ride, but certainly not how you expected your journey to end.</p>\n<p>(Of course, the next time you see Gandalf, you and Sam don&#39;t hesitate to buy a few bags of &#39;Grey Havens&#39; from him.)</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'You begin your ascent up Mt. Doom.': {
		'text': "<p>The Ring has never been so heavy. You repeatedly fall, again and again{if nakedHobbits=1:, and wish you&#39;d grabbed some shoes and pants back at the camp}. All common sense tells you Sam should carry the dumb thing and make it less of a burden on both of you. You wonder, should you <a class=\"squiffy-link link-section\" data-section=\"still keep carrying the Ring\" role=\"link\" tabindex=\"0\">still keep carrying the Ring</a> or <a class=\"squiffy-link link-section\" data-section=\"still keep carrying the Ring\" role=\"link\" tabindex=\"0\">still keep carrying the Ring</a>?</p>",
		'passages': {
		},
	},
	'still keep carrying the Ring': {
		'text': "<p>Your decision-making isn&#39;t up to par at the moment. You entertain a less-complicated choice: is your favourite colour <a class=\"squiffy-link link-section\" data-section=\"blue\" role=\"link\" tabindex=\"0\">blue</a> or <a class=\"squiffy-link link-section\" data-section=\"blue\" role=\"link\" tabindex=\"0\">blue</a>?</p>",
		'passages': {
		},
	},
	'blue': {
		'text': "<p>The Ring reminds you your favourite colour is blue. This is getting very annoying.</p>\n<p>Sam says something very moving that you don&#39;t hear, and then carries you up the mountain face, into a cave at the top.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue314\" role=\"link\" tabindex=\"0\">You arrive at the fires of Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'_continue314': {
		'text': "<p>Overlooking a pit of lava, Sam tells you &quot;This is it. Throw the Ring in, Mr. Frodo.&quot;</p>\n<p>You take your Ring off your chain and play with it for a bit. You carefully consider your options. Should you A) cast the Ring into the fires, B) <a class=\"squiffy-link link-section\" data-section=\"keep the Ring because it's yours\" role=\"link\" tabindex=\"0\">keep the Ring because it&#39;s yours</a>, or C) <a class=\"squiffy-link link-section\" data-section=\"keep the Ring because it's yours and also push Sam down on your way out?\" role=\"link\" tabindex=\"0\">keep the Ring because it&#39;s yours and also push Sam down on your way out?</a></p>",
		'passages': {
		},
	},
	'keep the Ring because it\'s yours': {
		'text': "<p>You suddenly remember you have no business being here. You remind Sam the Ring is yours and put it out. You then walk past Sam and <a class=\"squiffy-link link-section\" data-section=\"leave the cave.\" role=\"link\" tabindex=\"0\">leave the cave.</a></p>",
		'passages': {
		},
	},
	'keep the Ring because it\'s yours and also push Sam down on your way out?': {
		'text': "<p>You suddenly remember you have no business being here. You remind Sam the Ring is yours and put it on. You then push down {if nakedHobbits=1:Naked }Sam and <a class=\"squiffy-link link-section\" data-section=\"leave the cave.\" role=\"link\" tabindex=\"0\">leave the cave.</a></p>",
		'passages': {
		},
	},
	'leave the cave.': {
		'text': "<p>{if gollumDead=0:{if gollumKnows=1:<a class=\"squiffy-link link-section\" data-section=\"That's when Gollum shows up.\" role=\"link\" tabindex=\"0\">That&#39;s when Gollum shows up.</a>}}</p>\n<p>{if gollumDead=0:{if gollumKnows=0:<a class=\"squiffy-link link-section\" data-section=\"No one comes to stop you.\" role=\"link\" tabindex=\"0\">No one comes to stop you.</a>}}</p>\n<p>{if gollumDead=0:{if gollumKnows=0:You were certain Gollum might try for the Ring again. But knowing nothing of your mission, he lost track of you. It&#39;s just you and Sam now.}}</p>\n<p>{if gollumDead=1:<a class=\"squiffy-link link-section\" data-section=\"No one comes to stop you.\" role=\"link\" tabindex=\"0\">No one comes to stop you.</a>}}</p>",
		'passages': {
		},
	},
	'No one comes to stop you.': {
		'text': "<p>&quot;Don&#39;t do this!&quot; Sam shouts after you. &quot;That Ring is a curse! It will never bring you happiness!&quot;</p>\n<p>His pleas fall on deaf ears. The Ring has already spoken.</p>\n<p>Then at least don&#39;t <a class=\"squiffy-link link-section\" data-section=\"strand me on Mt. Doom\" role=\"link\" tabindex=\"0\">strand me on Mt. Doom</a>!&quot; he insists. &quot;If you&#39;re going to go Ring-crazy, let us <a class=\"squiffy-link link-section\" data-section=\"go Ring-crazy together\" role=\"link\" tabindex=\"0\">go Ring-crazy together</a>!&quot;</p>",
		'passages': {
		},
	},
	'strand me on Mt. Doom': {
		'text': "<p>You walk away, leaving Sam in the fiery depths of Mt. Doom.</p>\n<p>One year passes.</p>\n<p>After the Mordor incident, the war came to an unexpected end. Mordor repealed its forces and surrendered to Gondor. Saruman went into hiding. Middle-Earth entered an uneasy era of peace.</p>\n<p>You moved to Minas Tirith and used the Ring&#39;s power to <a class=\"squiffy-link link-section\" data-section=\"live the high life\" role=\"link\" tabindex=\"0\">live the high life</a>.</p>",
		'passages': {
		},
	},
	'live the high life': {
		'text': "<p>You got yourself a fancy loft in the city&#39;s highest tower. You found yourself hob-nobbing with the likes of King Denethor, and sitting in at his royal banquets. You&#39;d attend red carpet events with famous elven supermodels. The Ring brought you all the happiness it promised.</p>\n<p>Then, one day, at a royal ball, a carriage from Mordor rolls up to the castle&#39;s front entrance.</p>\n<p>Everyone is excited to see who arrived. You slip on the Ring, become invisible, and hide among the crowd to <a class=\"squiffy-link link-section\" data-section=\"see who it is\" role=\"link\" tabindex=\"0\">see who it is</a>.</p>",
		'passages': {
		},
	},
	'see who it is': {
		'text': "<p>The carriage driver speaks, &quot;Announcing his royal highness, the new Lord of Mordor, the all-exalted, high-superior Hobbit King... Samwise Gamgee!&quot;</p>\n<p>Sam emerges from the carriage in fancy Mordor appareil with his consort of orc bodyguards and his orc spouse. Everyone oohs and aahs at his grand arrival.</p>\n<p>You are shocked and want to know what happened in Mordor. Later at the ball, you wait until Sam is alone near the buffet table and <a class=\"squiffy-link link-section\" data-section=\"sneak up to confront him\" role=\"link\" tabindex=\"0\">sneak up to confront him</a>.\nBut Sam sees you coming.</p>",
		'passages': {
		},
	},
	'sneak up to confront him': {
		'text': "<p>He holds up his right hand. On his ringer is a New Ring.</p>\n<p>You stop approaching and keep at a distance. The New Ring is brighter and more powerful than your own.</p>\n<p>&quot;When you abandoned me, I made some new friends in Mordor,&quot; Sam says. &quot;We dived into the depths of Mt. Doom and found the means to forging a New Ring. It takes a special will to forge a Ring that doesn&#39;t answer to the others, but I think you gave me that will. Now your Ring is old news. Welcome to the age of Sam, Mr. Frodo.&quot;</p>\n<p>You suddenly want to <a class=\"squiffy-link link-section\" data-section=\"be part of his inner circle\" role=\"link\" tabindex=\"0\">be part of his inner circle</a>.</p>",
		'passages': {
		},
	},
	'be part of his inner circle': {
		'text': "<p>But Sam shuts you down. He puts on some shades and walks away. He rejoins his orc comrades and goes to speak with King Denethor who welcomes him and discusses an alliance with Mordor.</p>\n<p>Everyone&#39;s all about Sam now. Your Ring no longer holds power over the people. Even your plus-ones have abandoned you. Unless you want to <a class=\"squiffy-link link-section\" data-section=\"be Sam's gardener\" role=\"link\" tabindex=\"0\">be Sam&#39;s gardener</a> at this point, you better get used to being alone.</p>\n<p>&quot;All hail Samwise Gamgee!&quot; the crowd cheers, as he takes his entourage into the next room and closes the doors on you.</p>\n<p>And that&#39;s the story of how Samwise Gamgee became the new Lord of the Rings.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'be Sam\'s gardener': {
		'text': "<p>(And that&#39;s also how you became his gardener.)</p>",
		'passages': {
		},
	},
	'go Ring-crazy together': {
		'text': "<p>This suggestion piques the Ring&#39;s interest.</p>\n<p>&quot;I can&#39;t pretend I know what the Ring wants, but if it just wants ruin, we&#39;ll give it all it wants,&quot; Sam goes on. &quot;We&#39;ll leave this place and become travelers. We&#39;ll take the Ring away from good folk and bring it to terrible places where it can sow discord. We&#39;ll become harbingers of chaos, together. Just don&#39;t do it alone, Mr. Frodo.&quot;</p>\n<p>Even though the Ring doesn&#39;t share power, it suddenly likes the idea of a partner-in-crime. </p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue315\" role=\"link\" tabindex=\"0\">And that&#39;s how you and Sam became harbingers of chaos.</a></p>",
		'passages': {
		},
	},
	'_continue315': {
		'text': "<p>After leaving Mordor, you traveled together to the city of Minas Tirith.</p>\n<p>Using the Ring&#39;s power, you acquired cozy accommodations, ate at fancy restaurants, smoke their pipe-weed and drank of the city&#39;s finest wines. You and Sam spent the week living it up. It was pure heaven, putting a war behind you and indulging in a little fun for a change. Not once did the Ring drain your soul and make you faint.</p>\n<p>Then, when you had your fill, you let the Ring have its way with the city.</p>\n<p>You brought down the wretched King Denethor, robbed his banks, and drove his armies from the city. The people cheered your name as they moved into his white palace and helped themselves to the food he&#39;d been hoarding. The Ring delighted in a little revolution.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue316\" role=\"link\" tabindex=\"0\">You left the city as heroes and moved on.</a></p>",
		'passages': {
		},
	},
	'_continue316': {
		'text': "<p>Dol Amroth, Caer Lord, and Laketown were next. You&#39;d move in, enjoy a lovely hobbit vacation, then bring about a rebellion.</p>\n<p>You let Sam pick all the destinations, of course. He was up-to-date on local news and knew where all the corrupt politicians and crime bosses were hanging out. He&#39;d point at a map, steer you away from the good towns, and bring the Ring where it could do the most damage.</p>\n<p>The War of the Ring had suddenly become all of Middle-Earth&#39;s worst against two Hobbits with a magic Ring. Nobody came to help the towns you were overthrowing, and the locals welcomed your arrival, eager to see you topple their corrupt monarchies.</p>\n<p>You and Sam had become Dark Lords of the People.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue317\" role=\"link\" tabindex=\"0\">The Fellowship never caught up with you.</a></p>",
		'passages': {
		},
	},
	'_continue317': {
		'text': "<p>You were too clever and fast to be caught, even by a ranger like Aragorn. No wizard in Middle-Earth could find you because of the Ring&#39;s power. You became Sauron&#39;s will incarnate, tempered by Sam&#39;s love. The winds of change were upon Middle-Earth.</p>\n<p>The elves cleared out by the time they saw you coming, but you would catch up to them eventually. Once you were finished with Middle-Earth, you&#39;d move on to the rest of the world.</p>\n<p>You finally had all the power you ever wanted. </p>\n<p>And Samwise Gamgee? He finally had his Mr. Frodo back.</p>\n<p>THE END</p>",
		'passages': {
		},
	},
	'That\'s when Gollum shows up.': {
		'text': "<p>&quot;Our Precious! Gives it back!&quot; Gollum screams. Seeing your footprints in the dust, he pounces on your invisible self and fights for the Ring.</p>\n<p>You scream and howl as he bites your ring finger off. You turn visible{if nakedHobbits=1: and naked} as the Ring goes to Gollum.</p>\n<p>&quot;The Precious is ours!&quot; Gollum shouts triumphantly, waving the Ring in the air.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue318\" role=\"link\" tabindex=\"0\">Sam runs forward and roundhouse-kicks Gollum in the face.</a></p>",
		'passages': {
		},
	},
	'_continue318': {
		'text': "<p>Gollum flies backwards off the cliff and flails several feet into the lava below, holding the Ring. </p>\n<p>Like an ice cube in a frying pan, Gollum lays sputtering and screaming on the molten ore as it slowly sizzles and melts his flesh away. It&#39;s the most horrible thing you&#39;ve ever seen. You wish he&#39;d just sink into the lava, but that&#39;s not how lava actually works.</p>\n<p>The Ring eventually melts and vanishes into the fire.</p>\n<p>The volcano erupts.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You and Sam escape from Mt. Doom.\" role=\"link\" tabindex=\"0\">You and Sam escape from Mt. Doom.</a></p>",
		'passages': {
		},
	},
	'You and Sam escape from Mt. Doom.': {
		'text': "<p>The two of you are chased down the mountainside by a lava flow. You are saved at the last minute by some very convenient eagles. {if eaglesComing=1:The good kinds, not the ones who were hunting you. }{if nakedHobbits=1:You are lifted naked into the skies. It&#39;s a very liberating experience.}</p>\n<p>Riding the eagles is Gandalf{if gandalfDead=1:, alive and well}. {if gandalfAngry&gt;9:Of course, he&#39;s still peeved at your earlier shennanigans, so he asks the eagle to drop and catch you a few times out of spite. You probably deserve this. }</p>\n<p>{if nakedHobbits=1:He smells his special brand of pipe-weed on you and doesn&#39;t question your nudity. Instead he just smiles and nods. He&#39;s been there.}</p>\n<p>{if nakedHobbits=1:Down below, you see Ungoliant smash her way through Mordor&#39;s mountains and escape into parts unknown. She&#39;ll be riding that high for a while.}</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"You are taken to safety and your journey ends.\" role=\"link\" tabindex=\"0\">You are taken to safety and your journey ends.</a></p>",
		'passages': {
		},
	},
	'You are taken to safety and your journey ends.': {
		'text': "<p>{if nakedHobbits=1:Gandalf&#39;s first priority is finding you and Sam some pants.}</p>\n<p>It&#39;s later revealed that destroying the Ring literally destroyed all evil in the land. As in, the Earth opened up and conventiently swallowed every Orc.</p>\n<p>You discover that while you were in Mordor, Aragorn helped save the people of Middle-Earth at Helm&#39;s Deep and Minas Tirith and is made the King of Gondor. You suddenly don&#39;t feel bad for ditching him because that worked out really well.</p>\n<p>You go home, write a book about everything, and then eventually go on a boat ride with Uncle Bilbo to a place called &quot;The Grey Havens&quot;. Thus ends your fantastic journey through Middle-Earth. </p>\n<p>THE END</p>",
		'passages': {
		},
	},
}
})();