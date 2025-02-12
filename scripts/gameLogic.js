const { v4: uuidv4 } = require('uuid');

const toss = function(ws){
    let randomWinner;
    if(ws.opponent.isTossReady){
        ws.idTossReady = true;
        randomWinner = Math.random() < 0.5 ? ws : ws.opponent;
        const matchId = uuidv4();
        ws.matchId = matchId
        ws.opponent.matchId = matchId;
        ws.score = 0
        ws.opponent.score = 0
        if(ws.id === randomWinner.id) {
            ws.mark = "X";
            ws.opponent.mark = "O";
        }else {
            ws.mark = "O";
            ws.opponent.mark = "X";
        }
        try {
            ws.send(JSON.stringify({type: "toss-results", data: {userMark : ws.mark, opponentMark: ws.opponent.mark}}));
            ws.opponent.send(JSON.stringify({type: "toss-results", data: {userMark: ws.opponent.mark, opponentMark: ws.mark}}));
        }catch(error){
            console.log("Error sending toss results to clinets: ",error);
            ws.close();
            ws.opponent.close();
            return false;
        }
        return randomWinner;
    }else{
        ws.isTossReady = true;
        return false;
    }
}

exports.setInitialBoxValues = function(match, ws){
    if(match.moveTimerId){
        clearTimeout(match.moveTimerId);
    }
    match.moveTimerId = setTimeout(()=>{
       matchWon(match.playerTurn.opponent, "Time Out", [], match, false)
    },5000)
    match.boxValue.forEach((element, i) => {
        match.boxValue[i] = '';
    });
    ws.send(JSON.stringify({type: 'match-initial-info', data:{matchId: ws.matchId, round: match.round, playerTurn: match.playerTurn.userName}}));
    ws.opponent.send(JSON.stringify({type: 'match-initial-info', data:{matchId: ws.matchId, round: match.round, playerTurn: match.playerTurn.userName}}));
}

exports.onTossRequest = function(ws, matchesBeingPlayed){
    if(ws.opponent){
        const tossWinner = toss(ws);
        if(tossWinner){
            const valuesArr = ['','','','','','','','','']
            matchesBeingPlayed.set(ws.matchId, {player1: tossWinner, player2: tossWinner.opponent, round: 0, playerTurn: tossWinner, boxValue: valuesArr});
        }
    }
}

exports.beginMatch = function(ws){
    if(ws.opponent.isReady){
        ws.isReady = true;
        return ws.matchId
    } else {
        ws.isReady = true;
        return false;
    }
}

const matchWon = function(ws, info, winnigCondition, match,cond, position){
    ws.score = ws.score + 1;
    ws.isReady = false;
    ws.opponent.isReady = false
    if(cond){
        ws.opponent.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
        ws.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
    } else {
        match.playerTurn = ws
    }
    ws.send(JSON.stringify({type: 'match-won', data:{positionArray : winnigCondition , winner: true, winnerScore: ws.score, opponentScore: ws.opponent.score, info:info}}));
    ws.opponent.send(JSON.stringify({type: 'match-won', data:{positionArray : winnigCondition, winner: false, winnerScore: ws.score, opponentScore: ws.opponent.score, info:info}}));
}


exports.checkWinner =  function(ws, match, msgObj, moveTimerId){
    if(match.moveTimerId){
        clearTimeout(match.moveTimerId);
    }

    if(match.playerTurn = ws){
        const position = msgObj.data.position
        match.boxValue[Number(position.slice(3))] = msgObj.data.mark
        ws.moves.push({mark: msgObj.data.mark,position: position});

        let winnigCondition = [];

        const winConditions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        let roundWon = false;

        for(let i = 0; i < winConditions.length; i++){

            const condition = winConditions[i];
            const cellA = match.boxValue[condition[0]]
            const cellB = match.boxValue[condition[1]]
            const cellC = match.boxValue[condition[2]]

            if(cellA == "" || cellB == "" || cellC == ""){
                continue;
            }
            if(cellA == cellB && cellB == cellC){
                roundWon = true;
                winnigCondition = condition
                break;
            }
        }

        if(roundWon){
            matchWon(ws, '', [`box${winnigCondition[0]}`,`box${winnigCondition[1]}`,`box${winnigCondition[2]}`], match, true, position, moveTimerId)
        } else if(!match.boxValue.includes('')){
            match.playerTurn = ws.opponent;
            ws.isReady = false;
            ws.opponent.isReady = false
            const player1Score = ws === match.player1 ? match.player1.score : match.player2.score;
            const player2Score = ws === match.player1 ? match.player2.score : match.player1.score;

            ws.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
            ws.send(JSON.stringify({type: 'match-draw', data:{userScore: player1Score, opponentScore: player2Score}}));
            ws.opponent.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
            ws.opponent.send(JSON.stringify({type: 'match-draw', data:{userScore: player2Score, opponentScore: player1Score}}));
        } else {
            match.playerTurn =  ws.opponent
            ws.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));
            ws.opponent.send(JSON.stringify({type: 'move', data:{matchId: ws.matchId, round: match.round, mark:ws.mark, position: position, playerTurn: match.playerTurn.userName}}));

            match.moveTimerId = setTimeout(()=>{
                matchWon(match.playerTurn.opponent, "Time Out", [], match, false)
            },5000)
        }
    } else {
        throw new Error("wrong player move");
    }
}

exports.quitMatch = function(ws, matchesBeingPlayed){
    ws.opponent.send(JSON.stringify({type: 'error', message: `${ws.userName.userName} Quit`}));
    ws.opponent.isReady = false;
    ws.opponent.moves = [];
    ws.opponent.score = 0;
    ws.opponent.isTossReady = false;
    ws.opponent.matchId = '';
    matchesBeingPlayed.delete(ws.matchId);
    ws.close()
}