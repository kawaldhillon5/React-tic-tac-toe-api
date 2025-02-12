const User = require("../models/user");

exports.matchMaking = async function(clientsfindingMatch, ws){
    console.log("Clients in matchmaking queue:", clientsfindingMatch.map(client => client.id)); // Log client IDs
    if(clientsfindingMatch.length){
        const shiftedWs = clientsfindingMatch.shift()
        clearTimeout(shiftedWs.matchMakingTimeout);
        shiftedWs.matchMakingTimeout = null;
        try {
                const shiftedWsUsername = await User.findById(shiftedWs.id ,'userName').exec();
                const userName = await User.findById(ws.id,'userName').exec();
                if(!shiftedWsUsername && !userName){
                    throw new Error('Error setting opponent');
                }
                ws.opponent = shiftedWs;
                ws.moves = [];
                ws.userName = userName;
                shiftedWs.userName = shiftedWsUsername;
                shiftedWs.moves = [];
                shiftedWs.opponent = ws;
                ws.send(JSON.stringify({type: 'opponent', data: shiftedWsUsername}));
                shiftedWs.send(JSON.stringify({type: "opponent", data: userName}));
                console.log(`match found for : ${shiftedWs.id}`," to:", ws.id);
            } catch (error) {
                console.error('Error sending message to client:', error);
            }
    } else{
        console.log('no clients avaliable now, adding client to waiting array: ',ws.id);
        clientsfindingMatch.push(ws);

        //timeout function inCase no macth is found
        ws.matchMakingTimeout = setTimeout(()=>{
            console.log("matchmaking Timeout for client: ",ws.id);
            const index = clientsfindingMatch.indexOf(ws);
            if (index !== -1) {
                clientsfindingMatch.splice(index, 1);
                try{
                    ws.send(JSON.stringify({ type: 'timeout', message: 'Matchmaking timed out' })); // Inform the client
                } catch (sendError) {
                    console.error('Error sending timeout message to client:', sendError);
                } finally {
                    ws.close(); // Close the connection from the server
                    console.log(`Disconnected client ${ws.id} due to matchmaking timeout.`);
                }
            } else {
                console.log(`Client ${ws.id} was already removed from queue (likely matched). Timeout cleanup done.`);
            }
        },5000)
    }
}

