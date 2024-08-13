'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

import words from '../../public/words.json';

// Initialize Supabase client

const supabaseUrl = 'https://ovoaevfundstbattgqjy.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im92b2FldmZ1bmRzdGJhdHRncWp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTE4ODQ4ODAsImV4cCI6MjAwNzQ2MDg4MH0.ROQ9zJVIqgnoMz0mXj1h5DrLKYLzdF-HTKr6PxDYs_4'
console.log('supabaseKey: ', supabaseKey)  
const supabase = createClient(supabaseUrl, supabaseKey)

const DICE_LETTERS = [
  ['A', 'A', 'E', 'E', 'I', 'O'],
  ['U', 'Y', 'B', 'C', 'D', 'F'],
  ['G', 'H', 'L', 'M', 'N', 'P'],
  ['R', 'S', 'T', 'W', 'V', 'K'],
  ['X', 'Z', 'J', 'Q', 'I', 'E'],
  ['A', 'O', 'U', 'T', 'S', 'R']
];

const INITIAL_POINTS = 20;

const isRareLetter = (letter) => {
  const rareLetters = ['J', 'Q', 'X', 'Z'];
  return rareLetters.includes(letter.toUpperCase());
};

const Die = ({ letter, isCurrentPlayer }) => (
  <div
    className={`w-16 h-16 text-slate-900 bg-white border-2 border-gray-300 rounded-lg shadow-md flex items-center justify-center text-3xl font-bold m-1 
      ${isCurrentPlayer ? '' : 'opacity-50'}
      ${isRareLetter(letter) ? 'bg-yellow-500' : ''}
    }`}
  >
    {letter}
  </div>
);

const WordDiceGame = () => {
  
  const [gameId, setGameId] = useState(null);
  const [playerNumber, setPlayerNumber] = useState(null);
  const [gameState, setGameState] = useState({
    player1Dice: [],
    player2Dice: [],
    player1Word: '',
    player2Word: '',
    player1Score: INITIAL_POINTS,
    player2Score: INITIAL_POINTS,
    player1Status: 'initial',
    player2Status: 'initial',
    gameStatus: 'Not started',
    isGameActive: false,
    timeElapsed: 0,
  });

  const player1InputRef = useRef(null);
  const player2InputRef = useRef(null);
  const [localPlayer1Word, setLocalPlayer1Word] = useState('');
  const [localPlayer2Word, setLocalPlayer2Word] = useState('');
  const [player1InputValid, setPlayer1InputValid] = useState(true);
  const [player2InputValid, setPlayer2InputValid] = useState(true);

  const updateGameState = async (updates) => {
    try {
      await supabase
        .from('games')
        .update(updates)
        .eq('id', gameId);
      setGameState(prev => ({ ...prev, ...updates }));
    } catch (error) {
      console.error('Error updating game state:', error);
      setGameState(prev => ({ ...prev, gameStatus: 'Error updating game state. Please try again.' }));
    }
  };

  const endGame = async () => {
    try {
      const updateObj = {
        isGameActive: false,
        gameStatus: determineWinner(),
      };

      await supabase
        .from('games')
        .update(updateObj)
        .eq('id', gameId);

      setGameState(prev => ({ ...prev, ...updateObj }));
    } catch (error) {
      console.error('Error ending game:', error);
      setGameState(prev => ({ ...prev, gameStatus: 'Error ending game. Please try again.' }));
    }
  };

  const determineWinner = () => {
    if (gameState.player1Score > gameState.player2Score) {
      return 'Player 1 wins!';
    } else if (gameState.player2Score > gameState.player1Score) {
      return 'Player 2 wins!';
    } else {
      return 'It\'s a tie!';
    }
  };

  const getRandomWord = () => {
    const eligibleWords = words.filter(word => word.length >= 4 && word.length <= 6);
    return eligibleWords[Math.floor(Math.random() * eligibleWords.length)].toUpperCase();
  };

  const scrambleWord = (word) => {
    return word.split('').sort(() => Math.random() - 0.5).join('');
  };

  const padWithRandomLetters = (letters, targetLength) => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    while (letters.length < targetLength) {
      letters.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    return letters;
  };



  const timerRef = useRef(null);

  useEffect(() => {
    if (playerNumber === 1 && gameState.isGameActive && gameState.player1Status !== 'submitted') {
      console.log('focusing on player 1 input...')
      setTimeout(() => {
        try {
          player1InputRef.current.focus();
        } catch (error) {
          console.error('Error focusing on player 1 input:', error);
        }
      }, 2000);
    }
    if (playerNumber === 2 && gameState.isGameActive && gameState.player2Status !== 'submitted') {
      console.log('focusing on player 2 input...')
      setTimeout(() => {
        try {
          player2InputRef.current.focus();
        } catch (error) {
          console.error('Error focusing on player 2 input:', error);
        }
      }, 2000);
    }
  }, [playerNumber, gameState.isGameActive, gameState.player1Status, gameState.player2Status]);


  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameIdFromUrl = urlParams.get('gameId');
    if (gameIdFromUrl) {
      console.log('gameIdFromUrl: ', gameIdFromUrl)
      console.log('joining game...')
      joinGame(gameIdFromUrl);
    }
    if (gameId) {
      const channelId = `game:${gameId.replace(/-/g, '')}`
      // const channelId = `game:updates`
      const channel = supabase
        .channel(channelId)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, payload => {
          setGameState(prevState => {
            const newState = { ...prevState, ...payload.new };
            // Preserve local input if it's different from the server state
            if (playerNumber === 1 && localPlayer1Word !== newState.player1Word) {
              newState.player1Word = localPlayer1Word;
            }
            if (playerNumber === 2 && localPlayer2Word !== newState.player2Word) {
              newState.player2Word = localPlayer2Word;
            }
            return newState;
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [gameId, localPlayer1Word, localPlayer2Word, playerNumber]);

  const handleInputChange = (player, value) => {
    if (playerNumber === 1) {
      setLocalPlayer1Word(value);
      setPlayer1InputValid(true); 
      updateGameState({ player1Word: value });
    } else {
      setLocalPlayer2Word(value);
      setPlayer2InputValid(true);
      updateGameState({ player2Word: value });
    }
  };

  const handleKeyDown = (e, player) => {
    if (e.key === 'Enter') {
      submitWord(player, player === 1 ? localPlayer1Word : localPlayer2Word);
    } else if (e.code === 'Space') {
      e.preventDefault(); // Prevent space from being entered in the input
      changeOneLetter(player);
    }
    if (playerNumber === 1) {
      setPlayer1InputValid(true);
    } else {
      setPlayer2InputValid(true);
    }
  };

  const joinGame = async (gameIdToJoin) => {
    try {
      console.log(`joining game...${gameIdToJoin}`)
      console.log('gameIdToJoin type: ', typeof gameIdToJoin)
      const { data, error } = await supabase
        .from('games')
        .update({ player2: 'Player 2' })
        .eq('id', gameIdToJoin)

      if (error) throw error;

      console.log('joinGame data: ', data)

      setGameId(gameIdToJoin);
      setPlayerNumber(2);
    } catch (error) {
      console.error('Error joining game:', error);
      setGameState(prev => ({ ...prev, gameStatus: 'Error joining game. Please try again.' }));
    }
  };

  const createOrJoinGame = async () => {
    try {
      // Check for an available game
      let { data: availableGame } = await supabase
        .from('games')
        .select('id')
        .is('player2', null)
        .limit(1);

      if (availableGame && availableGame.length > 0) {
        // Join existing game
        const gameId = availableGame[0].id;
        await supabase
          .from('games')
          .update({ player2: 'Player 2' })
          .eq('id', gameId);
        setGameId(gameId);
        setPlayerNumber(2);
      } else {
        // Create new game
        const { data, error } = await supabase
          .from('games')
          .insert({
            player1: 'Player 1',
            player1Score: INITIAL_POINTS,
            player2Score: INITIAL_POINTS,
            player1Word: '',
            player2Word: '',
            player1Status: 'initial',
            player2Status: 'initial',
            player1Dice: [],
            player2Dice: [],
            gameStatus: 'Waiting for player 2',
            isGameActive: false,
            timeElapsed: 0
          })
          .select();
        if (error) throw error;
        setGameId(data[0].id);
        setPlayerNumber(1);
      }
    } catch (error) {
      console.error('Error creating/joining game:', error);
      setGameState(prev => ({ ...prev, gameStatus: 'Error creating/joining game. Please try again.' }));
    }
  };

  const changeOneLetter = async (player) => {
    try {
      const currentDice = player === 1 ? gameState.player1Dice : gameState.player2Dice;
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      
      // Choose a random position to change
      const positionToChange = Math.floor(Math.random() * currentDice.length);
      
      // Generate a new letter, ensuring it's different from the current one
      let newLetter;
      do {
        newLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
      } while (newLetter === currentDice[positionToChange]);
      
      // Create a new dice array with the changed letter
      const newDice = [...currentDice];
      newDice[positionToChange] = newLetter;
      
      // Update the game state
      const updateObj = {
        [`player${player}Dice`]: newDice,
        gameStatus: `Player ${player} changed a letter`
      };
      
      await supabase
        .from('games')
        .update(updateObj)
        .eq('id', gameId);
      
      // Update local state
      setGameState(prev => ({ ...prev, ...updateObj }));
    } catch (error) {
      console.error('Error changing letter:', error);
      setGameState(prev => ({ ...prev, gameStatus: 'Error changing letter. Please try again.' }));
    }
  };

  const rollDice = async () => {
    try {
      console.log('rolling dice...')
      // const newDice1 = DICE_LETTERS.map(die => die[Math.floor(Math.random() * die.length)]);
      // const newDice2 = DICE_LETTERS.map(die => die[Math.floor(Math.random() * die.length)]);
      const word1 = getRandomWord();
      const word2 = getRandomWord();

      console.log('word1: ', word1)
      console.log('word2: ', word2)
      let newDice1 = scrambleWord(word1).split('');
      let newDice2 = scrambleWord(word2).split('');
      
      newDice1 = padWithRandomLetters(newDice1, 6);
      newDice2 = padWithRandomLetters(newDice2, 6);

      setLocalPlayer1Word('');
      setLocalPlayer2Word('');
      
      await supabase
        .from('games')
        .update({ 
          player1Dice: newDice1,
          player2Dice: newDice2,
          player1Score: INITIAL_POINTS,
          player2Score: INITIAL_POINTS,
          player1Status: 'initial',
          player2Status: 'initial',
          player1Word: '',
          player2Word: '',
          gameStatus: 'Game Started',
          isGameActive: true,
          timeElapsed: 0
        })
        .eq('id', gameId);
    } catch (error) {
      console.error('Error rolling dice:', error);
      setGameState(prev => ({ ...prev, gameStatus: 'Error rolling dice. Please try again.' }));
    }
  };

  const calculateWordLengthBonus = (word) => {
    return word.length * 2; // 2 points per letter
  };
  
  const calculateUniqueLettersBonus = (word) => {
    const uniqueLetters = new Set(word.toUpperCase()).size;
    return uniqueLetters * 3; // 3 points per unique letter
  };
  
  const calculateRarityBonus = (word) => {
    const rareLetters = 'JQXZ';
    return word.toUpperCase().split('').filter(char => rareLetters.includes(char)).length * 8; // 5 points per rare letter
  };
  
  const calculateComboBonus = (word) => {
    let bonus = 0;
    if (word.length >= 6) bonus += 10; // Long word bonus
    if (new Set(word.toUpperCase()).size === word.length) bonus += 15; // All unique letters bonus
    if (word.match(/[aeiou]/gi) && word.match(/[aeiou]/gi).length === 1) bonus += 20; // One vowel only bonus
    return bonus;
  };

  const submitWord = async (player, word) => {
    if (!gameState.isGameActive) return;
  
    const dice = player === 1 ? gameState.player1Dice : gameState.player2Dice;
    const validWord = await validateWord(word, dice);
    if (validWord) {
      try {
        const isFirstSubmission = (player === 1 && gameState.player2Status !== 'submitted') ||
                                (player === 2 && gameState.player1Status !== 'submitted');
        const baseScore = Math.max(0, INITIAL_POINTS - gameState.timeElapsed);
        const wordLengthBonus = calculateWordLengthBonus(word);
        const uniqueLettersBonus = 0;
        const rarityBonus = calculateRarityBonus(word);
        const firstSubmissionBonus = isFirstSubmission ? 5 : 0;
        const comboBonus = 0;
        
        const totalScore = baseScore + wordLengthBonus + uniqueLettersBonus + rarityBonus + firstSubmissionBonus + comboBonus;
        console.log('totalScore: ', totalScore)
                          
  
        const updateObj = {
          [`player${player}Word`]: word,
          [`player${player}Score`]: totalScore,
          [`player${player}Status`]: 'submitted',
          gameStatus: `Player ${player} submitted: ${word}`
        };
  
        // Update the game state first
        await supabase
          .from('games')
          .update(updateObj)
          .eq('id', gameId);
  
        // Get the updated game state
        const { data, error } = await supabase
          .from('games')
          .select('*')
          .eq('id', gameId)
          .single();
  
        if (error) {
          console.error('Error submitting word:', error);
          setGameState(prev => ({ ...prev, gameStatus: 'Error submitting word. Please try again.' }));
        } else {
          // Check if both players have submitted their words
          if (data.player1Status === 'submitted' && data.player2Status === 'submitted') {
            updateObj.isGameActive = false;
            updateObj.gameStatus = data.player1Score > data.player2Score ? 'Player 1 wins!' :
                                    data.player2Score > data.player1Score ? 'Player 2 wins!' :
                                    'It\'s a tie!';
  
            // Update the game state again with the final status
            await supabase
              .from('games')
              .update(updateObj)
              .eq('id', gameId);
          }
  
          setGameState(data);
          console.log('gameState: ', data)
        }
      } catch (error) {
        console.error('Error submitting word:', error);
        setGameState(prev => ({ ...prev, gameStatus: 'Error submitting word. Please try again.' }));
      }
    } else {
      console.log('invalid word: ', word);
      setGameState(prev => ({ ...prev, gameStatus: `Player ${player}: Invalid word.` }));
      if (player === 1) {
        setPlayer1InputValid(false);
      } else {
        setPlayer2InputValid(false);
      }
    }
  };

  const validateWord = async (word, dice) => {
    const diceLetters = [...dice];
    for (let char of word.toUpperCase()) {
      const index = diceLetters.indexOf(char);
      if (index === -1) return false;
      diceLetters.splice(index, 1);
    }
    // const response = await fetch(`https://api.datamuse.com/words?sp=${word}`);
    // const data = await response.json();
    // console.log('datamuse: ', data)
    // return data.length > 0;
    if (!words.includes(word.toLowerCase())) {
      console.log('invalid word: ', word)
      return false;
    }
    console.log('valid word: ', word)
    return true;
  };

  useEffect(() => {
    if (gameState.isGameActive &&  playerNumber === 1) {
      console.log('gameState.isGameActive....')
      timerRef.current = setInterval(async () => {
        try {
          const updateObj = {
            timeElapsed: gameState.timeElapsed + 1,
          };
  
          const { data, error } = await supabase
            .from('games')
            .update(updateObj)
            .eq('id', gameId);
          console.log('updateObj: ', data)
          if (updateObj.timeElapsed >= 20) {
            clearInterval(timerRef.current);
            await endGame();
          }
        } catch (error) {
          console.error('Error updating timer:', error);
        }
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [gameState.isGameActive, gameState.timeElapsed, gameId]);

  if (!gameId) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <button 
          onClick={createOrJoinGame} 
          className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Create or Join Game
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto bg-slate-950">
      <h1 className="text-6xl text-slate-100 font-bold mb-6 text-center">wordie</h1>
      
      {playerNumber === 1 && !gameState.player2 && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
          <p className="font-bold">Waiting for Player 2</p>
          <p>Share this game ID with your friend: <a href={`${window.location.origin}?gameId=${gameId}`} target="_blank" rel="noopener noreferrer">{gameId}</a></p>
        </div>
      )}

      {playerNumber === 2 && !gameState.isGameActive && gameState.gameStatus === 'Not started' && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 mb-4" role="alert">
          <p className="font-bold">Waiting for Player 1</p>
          <p>{`Player 1 needs to start game ${gameId}`}</p>
        </div>
      )}
      
      {gameState.player1 && gameState.player2 && !gameState.isGameActive && (
        <button 
          onClick={rollDice} 
          className="w-full mb-6 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-700"
        >
          Start New Game
        </button>
      )}
    {gameState.player1 && gameState.player2 && gameState.timeElapsed > 0 && (
      <div>
        <div className="mb-8 bg-slate-900 p-4 rounded-lg">
          <div className="flex justify-between">
            <h2 className="text-2xl text-slate-500 font-semibold mb-2">Player 1 {playerNumber === 1 ? '(You)' : ''}</h2>
            {/* <p className="text-xl mb-2 text-slate-100">Score: {gameState.player1Score}</p> */}
          </div>
          <div className="flex flex-wrap justify-center mb-4">
            {gameState.player1Dice.map((letter, index) => (
              <Die key={index} letter={letter} isCurrentPlayer={playerNumber === 1} />
            ))}
          </div>
          <div className="flex justify-center border border-slate-700 md:mx-24">
            <div>
              <input
                type="text"
                ref={player1InputRef}
                value={playerNumber === 1 ? localPlayer1Word : gameState.player1Word}
                onChange={(e) => handleInputChange(1, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 1)}
                placeholder={playerNumber === 1 ? 'Enter word' : ''}
                className={`w-full  md:w-[300px] mr-2 pl-16 py-1 border-none outline-none bg-transparent text-3xl font-bold text-slate-100 px-3 py-3 uppercase text-center ${
                  player1InputValid ? '' : 'text-red-500'
                }`}
                disabled={playerNumber !== 1 || !gameState.isGameActive || gameState.player1Status === 'submitted'}
              />
            </div>
            <div className="text-slate-400 text-sm mt-4 mb-4 mr-4 bg-slate-800 px-2 py-1 rounded-lg font-mono w-[90px] text-center">
            {gameState.player1Status != 'submitted' ? (
                playerNumber === 1 ? `Enter` : '...'
              ) : (
                `${gameState.player1Score} pts`
              )}
            </div>
          </div>
        </div>
        
        <div className="mb-8 bg-slate-900 p-4 rounded-lg">
          <div className="flex justify-between">
            <h2 className="text-2xl text-slate-500 font-semibold mb-2">Player 2 {playerNumber === 2 ? '(You)' : ''}</h2>
            {/* <p className="text-normal mb-2 text-slate-100">Score: {gameState.player2Score}</p> */}
          </div>
          <div className="flex flex-wrap justify-center mb-4">
            {gameState.player2Dice.map((letter, index) => (
              <Die key={index} letter={letter} isCurrentPlayer={playerNumber === 2} />
            ))}
          </div>
          <div className="flex justify-center border border-slate-700 mx-24">
            <div>
              <input
                type="text"
                ref={player2InputRef}
                value={playerNumber === 2 ? localPlayer2Word : gameState.player2Word}
                onChange={(e) => handleInputChange(2, e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 2)}
                placeholder={playerNumber === 2 ? 'Enter word' : ''}
                className="w-full mr-2 pl-16 py-1 border-none outline-none bg-transparent text-3xl font-bold text-slate-100 px-3 py-3 uppercase text-center w-[300px]"
                disabled={playerNumber !== 2 || !gameState.isGameActive || gameState.player2Status === 'submitted'}
              />
            </div>
            <div className="text-slate-400 text-sm mt-4 mb-4 mr-4 bg-slate-800 px-2 py-1 rounded-lg font-mono w-[90px] text-center">
              {gameState.player2Status != 'submitted' ? (
                playerNumber === 2 ? `Enter` : '...'
              ) : (
                `${gameState.player2Score} pts`
              )}
            </div>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
          <div
            className="bg-blue-500 h-4 rounded-full"
            style={{ width: `${Math.max(0, (INITIAL_POINTS - gameState.timeElapsed) / INITIAL_POINTS * 100)}%` }}
          ></div>
        </div>
        
        {gameState.gameStatus && (
          <div className="bg-slate-900 border-l-4 border-slate-500 text-slate-100 p-4" role="alert">
            <p className="font-bold">Game Status</p>
            <p>{gameState.gameStatus}</p>
          </div>
        )}
      </div>
    )}
    </div>
  );
};

export default WordDiceGame;