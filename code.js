<!doctype html>
<html lang="en">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
		<link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossorigin="anonymous">
		<title>Mastermind Solver</title>
	</head>
	<body>
		<div class="container">
			<div>
				<div class="form-row algin-items-center">
					<div class="col-md-1">
						<label for="numLabels" class="col-form-label">Numbers:</label>
					</div>
					<div class="col-md-4">
						<input type="text" class="form-control" id="numLabels" value="1, 2, 3, 4, 5, 6, 7, 8, 9">
					</div>
					<div class="col-md-2">
						<label for="numPegs" class="col-form-label">Number of Pegs:</label>
					</div>
					<div class="col-md-1">
						<input type="number" class="form-control" id="numPegs" min="1" step="1" value="3">
					</div>
					<div class="col-md-2">
						<div class="form-check">
							<input type="checkbox" class="form-check-input" id="allowDups" checked="false">
							<label for="allowDups" class="form-check-label">Allow duplicate colors</label>
						</div>
					</div>
					<div class="col-md-2">
						<button id="start" class="btn btn-primary">Start</button>
					</div>
				</div>
				<div id="input-alert" class="alert alert-danger" style="display: none">
					Something went wrong.
				</div>
			</div>
			<hr/>
			<div id="play-area">
				<table id="old-guesses-table" class="table table-striped table-hover" style="display: none">
					<thead>
						<tr><th>Guess</th><th>Right number and column</th><th>Right number, wrong column</th></tr>
					</thead>
					<tbody id="old-guesses">
					</tbody>
				</table>
				<div id="cur-guess">
				</div>
				<div id="cur-guess-alert" class="alert alert-danger" style="display: none">
					Something went wrong.
				</div>
				<div id="success" class="alert alert-success" style="display: none">
					Congratulations! Click "Restart" to try again.
				</div>
				<script id="new-guess-template" type="text/x-handlebars-template">
					<div class="guess">Is it maybe <b>{{guess}}</b>?</div>
					<div class="form-inline">
						<label>Right number and Column: </label>
						<input type="number" min="0" step="1" max="{{numPegs}}" value="0" class="form-control bothCorrect">
						<label>Right number, wrong Column: </label>
						<input type="number" min="0" step="1" max="{{numPegs}}" value="0" class="form-control colorCorrect">
						<button class="btn btn-primary">Next</button>
					</div>
				</script>
				<script id="old-guess-template" type="text/x-handlebars-template">
					<tr class="evidence"><td>{{guess}}</td><td>{{bothCorrect}}</td><td>{{colorCorrect}}</tr></tr>
				</script>
			</div>
		</div>
		<script src="https://code.jquery.com/jquery-3.3.1.slim.min.js" integrity="sha384-q8i/X+965DzO0rT7abK41JStQIAqVgRVzpbzo5smXKp4YfRvH+8abtTE1Pi6jizo" crossorigin="anonymous"></script>
		<script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.1.2/handlebars.min.js" integrity="sha256-ngJY93C4H39YbmrWhnLzSyiepRuQDVKDNCWO2iyMzFw=" crossorigin="anonymous"></script>
		<script type="text/javascript">
			$(function() {
				'use strict';
				var $startBtn = $('#start');
				var $oldGuessesTable = $('#old-guesses-table');
				var $playAreaOldGuesses = $('#old-guesses');
				var $playAreaCurGuess = $('#cur-guess');
				var $numLabels = $('#numLabels');
				var $numPegs = $('#numPegs');
				var $allowDups = $('#allowDups');
				var $inputAlert = $('#input-alert');
				var $curGuessAlert = $('#cur-guess-alert');
				var $success = $('#success');
				var newGuessTemplate = Handlebars.compile($('#new-guess-template').html());
				var oldGuessTemplate = Handlebars.compile($('#old-guess-template').html());

				/*
				 * Structure is like:
				 * { numPegs: 4, colors: ["red", "green",."blue"], allowDups: true}
				 */
				var globalGameState = null;

				function pickFromArray(arr) {
					return arr[Math.floor(Math.random() * arr.length)];
				}

				/**
				 * @param colors e.g. ["red", "green", "blue"];
				 * @return e.g. [[rrr], [rrg], [rrb], [rgr], ... ]
				 */
				function generateAllPossibleGuessesWithDups(numPegs, colors) {
					if (numPegs < 1) {
						throw "numPegs must be at least 1.";
					}
					if (numPegs === 1) {
						return colors.slice(0);
					}
					let suffixes = generateAllPossibleGuessesWithDups(numPegs - 1, colors);
					let retVal = [];
					colors.forEach((color) => {
						suffixes.forEach((suffix) => {
							retVal.push([color].concat(suffix));
						});
					});
					return retVal;
				}

				function generateAllPossibleGuessesNoDups(numPegs, colors) {
					if (numPegs < 1) {
						throw "numPegs must be at least 1.";
					}
					if (numPegs === 1) {
						return colors.slice(0);
					}
					let retVal = [];
					for (let index = 0; index < colors.length; index++) {
						let firstColor = colors[index];
						let remainingColors = colors.filter((element, otherIndex) => otherIndex != index);
						let suffixes = generateAllPossibleGuessesNoDups(numPegs - 1, remainingColors);
						suffixes.forEach((suffix) => {
							retVal.push([firstColor].concat(suffix));
						});
					}
					return retVal;
				}

				/**
				 * @param answer e.g. ["red", "green", "blue", "blue"]
				 * @param guess e.g. ["blue, green", "yellow", "red"]
				 * return e.g. { bothCorrect: 1, colorCorrect: 2 }
				 */
				function judgeGuess(answer, guess) {
					let retVal = {bothCorrect: 0, colorCorrect: 0};
					let unaccountedForAnswers = [];
					let unaccountedForGuesses = [];
					for (let i = 0; i < answer.length; ++i) {
						if (answer[i] == guess[i]) {
							retVal.bothCorrect++;
						} else {
							unaccountedForAnswers.push(answer[i]);
							unaccountedForGuesses.push(guess[i]);
						}
					}
					unaccountedForAnswers.forEach((a) => {
						var guessIndex = unaccountedForGuesses.indexOf(a);
						if (guessIndex != -1) {
							retVal.colorCorrect++;
							unaccountedForGuesses.splice(guessIndex, 1);
						}
					})
					return retVal;
				}

				/**
				 * @param guess e.g. ["red", "green", "blue"]
				 * @param evidences e.g. [{guess: ["red", "red", "red"], bothCorrect: 0, colorCorrect: 0}]
				 * @return e.g. false
				 */
				function guessContradictsSomeEvidence(guess, evidences) {
					for (let key in evidences) {
						let evidence = evidences[key];
						/*
						 * Treat the guess like an answer and the evidence as a guess, and
						 * see whether the judgment is the same.
						 */
						let judgement = judgeGuess(guess, evidence.guess);
						if ((judgement.bothCorrect != evidence.bothCorrect) || (judgement.colorCorrect != evidence.colorCorrect)) {
							//console.log("guess", guess, "contradicts evidence", evidence.guess);
							return true;
						}
					}
					return false;
				}

				/**
				 * Removes and returns the element at the provided index from an array.
				 * This function may shuffle/reorder the elements of the array for
				 * efficiency reasons. For example, if you request to remove the first
				 * element of the array, rather than reindexing every element in the
				 * array (O(N)), this function may choose to swap the first and last
				 * element of the array, and then remove the last element from the
				 * array (O(1)).
				 */
				function quickRemoveFromArray(index, array) {
					var arrayLength = array.length;
					if (index >= arrayLength || index < 0) {
						throw "Tried to access index " + index + " from array of length " + arrayLength;
					}
					if (arrayLength === 1) {
						return array.pop();
					}
					var retVal = array[index];
					var lastElement = array.pop();
					array[index] = lastElement;
					return retVal;
				}

				/**
				 * Returns an array e.g. ["red", "green", "blue"] or null to indicate
				 * that there are no possible guesses left. It randomly selects one of
				 * the guesses from the provided `gameState` parameter, and removes
				 * that guess from the list of possible guesses. This function may also
				 * "shuffle" or reorder the elements in the possible guesses list for
				 * efficiency reasons.
				 */
				function generateNextGuess(gameState, evidence) {
					let guessIndex = Math.floor(Math.random() * gameState.possibleGuesses.length);
					let guess = quickRemoveFromArray(guessIndex, gameState.possibleGuesses);
					while (guessContradictsSomeEvidence(guess, evidence)) {
						if (gameState.possibleGuesses.length < 1) {
							return null;
						}
						guessIndex = Math.floor(Math.random() * gameState.possibleGuesses.length);
						guess = quickRemoveFromArray(guessIndex, gameState.possibleGuesses);
					}
					if (typeof guess !== 'object') {
						debugger;
						throw "Expected guess to be an array, but it was " + (typeof guess);
					}
					return guess;
				}

				function guessToString(guess) {
					if ((typeof guess) !== "object") {
						throw "Expected guess to be an array but it was a " + (typeof guess);
					}
					return guess.join(", ");
				}

				function updateUiWithAGuess() {
					$curGuessAlert.hide();
					$success.hide();
					if ($playAreaCurGuess.find('input').length != 0) {
						let bothCorrect = parseInt($playAreaCurGuess.find('.bothCorrect').val());
						let colorCorrect = parseInt($playAreaCurGuess.find('.colorCorrect').val());
						if (bothCorrect + colorCorrect > globalGameState.numPegs) {
							$curGuessAlert.text("The sum of Right-Color-and-Column and Right-color-wrong-column should be less than the number of pegs.");
							$curGuessAlert.show();
							return;
						}
						if (bothCorrect == globalGameState.numPegs) {
							$curGuessAlert.hide();
							$success.show();
							return;
						}
						$oldGuessesTable.show();
						let guess = $playAreaCurGuess.find('.guess').data('guess');
						let $guessToAdd = $(oldGuessTemplate({
							guess: guessToString(guess),
							bothCorrect: bothCorrect,
							colorCorrect: colorCorrect
						}));
						$guessToAdd.data('evidence', {
							guess: guess,
							bothCorrect: bothCorrect,
							colorCorrect: colorCorrect
						});
						$playAreaOldGuesses.append($guessToAdd);
					}
					var evidence = [];
					$playAreaOldGuesses.find('.evidence').each((index, evidenceRow) => {
						let $evidenceRow = $(evidenceRow);
						evidence.push($evidenceRow.data('evidence'));
					});
					var guess = generateNextGuess(globalGameState, evidence);
					if (guess == null) {
						$playAreaCurGuess.hide();
						$curGuessAlert.html("Ran out of possible guesses. There might be a contradiction in the information you entered above. If you think this is a bug, please file a report at <a href='https://github.com/NebuPookins/JS-Mastermind-Solver/issues'>https://github.com/NebuPookins/JS-Mastermind-Solver/issues</a>. Otherwise, click 'Restart' to try a new game.");
						$curGuessAlert.show();
					} else {
						$playAreaCurGuess.html(newGuessTemplate({
							guess: guessToString(guess),
							numPegs: globalGameState.numPegs
						}));
						$playAreaCurGuess.find('.guess').data('guess', guess);
						$playAreaCurGuess.show();
					}
				}

				$startBtn.on('click', () => {
					$playAreaOldGuesses.html('');
					$playAreaCurGuess.html('');
					$inputAlert.hide();
					$curGuessAlert.hide();
					$success.hide();
					var numPegs = parseInt($numPegs.val(), 10);
					if (numPegs < 1) {
						$inputAlert.text("Need at least one peg.");
						$inputAlert.show();
						return
					}
					var parsedColors = $numLabels.val()
						.split(/[ ,]+/)
						.map((color) => color.trim())
						.filter((color) => color != "");
					parsedColors
					if (parsedColors.length < 1) {
						$inputAlert.text("Need at least one color.");
						$inputAlert.show();
						return
					}
					var allowDups = $allowDups.is(':checked');
					if (!allowDups) {
						if (parsedColors.length < numPegs) {
							$inputAlert.text("If duplicates are not allowed, need at least as many colors as there are pegs.");
							$inputAlert.show();
							return
						}
					}
					let possibleGuesses = allowDups ? generateAllPossibleGuessesWithDups(numPegs, parsedColors) :
						generateAllPossibleGuessesNoDups(numPegs, parsedColors);

					globalGameState = {
						numPegs: numPegs,
						colors: parsedColors,
						allowDups: allowDups,
						possibleGuesses: possibleGuesses
					};
					console.log(globalGameState);
					$startBtn.text("Restart");
					updateUiWithAGuess();
				});
				$playAreaCurGuess.on('click', 'button', updateUiWithAGuess);
				(() => { //Unit tests
					function assertEqual(actual, expected) {
						if (actual !== expected) {
							return { onFail: (f) => { f(); throw "Test case failed."; } };
						} else {
							return { onFail: (f) => { /*Does nothing*/} };
						}
					}
					function guessContradictsSomeEvidenceTestCase(guess, evidence, expected) {
						let result = guessContradictsSomeEvidence(guess, evidence);
						assertEqual(result, expected).onFail(() => {
							console.log("Expected guess", guess, "with evidence", evidence, "to result in", expected);
							// debugger;
							guessContradictsSomeEvidence(guess, evidence);
						});
					}
					(() => {
						/*
						 * https://github.com/NebuPookins/JS-Mastermind-Solver/issues/3
						 * With 8+ colors, 4 pegs, and no duplicates, if the first 4 colors
						 * don't appear in the solution, then the next guess should only
						 * contain colors that were not yet guessed.
						 */
						let numPegs = 4;
						let colors = [1, 2, 3, 4, 5, 6, 7, 8];
						let evidence = [
							{ guess: [1, 2, 3, 4], bothCorrect: 0, colorCorrect: 0 }
						];
						for (let i = 0; i < 100; i++) {
							let gameState = {
								numPegs: numPegs,
								colors: colors,
								allowDups: false,
								possibleGuesses: generateAllPossibleGuessesNoDups(numPegs, colors)
							};
							let result = generateNextGuess(gameState, evidence);
							assertEqual(
								result.includes(1) || result.includes(2) || result.includes(3) || result.includes(4),
								false
								).onFail(() => {
									console.log("Expected result to not include", evidence[0].guess, "but was", result);
								});
							}
						})()
					
					//generic tests
					guessContradictsSomeEvidenceTestCase(["R", "G", "B", "Y"], [{guess: ["B", "G", "C", "C"], bothCorrect: 1, colorCorrect: 1}], false);
					guessContradictsSomeEvidenceTestCase(["R", "B", "Y", "R"], [{guess: ["G", "B", "R", "Y"], bothCorrect: 1, colorCorrect: 3}], true);
					guessContradictsSomeEvidenceTestCase(["R", "G", "B", "Y"], [
						{guess: ["R", "R", "R", "B"], bothCorrect: 1, colorCorrect: 1},
						{guess: ["Y", "R", "B", "G"], bothCorrect: 1, colorCorrect: 3},
					], false);
					console.log("All tests pass")
				})//(); //Uncomment to run unit tests.
			});
		</script>
	</body>
</html>