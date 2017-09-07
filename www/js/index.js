
var app = function() {

    var self = {};
    self.is_configured = false;

    var server_url = "https://luca-ucsc-teaching-backend.appspot.com/keystore/";
    var call_interval = 2000;

    Vue.config.silent = false; // show all warnings

    // Extends an array
    self.extend = function(a, b) {
        for (var i = 0; i < b.length; i++) {
            a.push(b[i]);
        }
    };

    self.initialize = function () {
        document.addEventListener('deviceready', self.ondeviceready, false);
    };

    self.ondeviceready = function () {
        // This callback is called once Cordova has finished its own initialization.
        //console.log("The device is ready");

        $("#vue-div").show();
        self.is_configured = true;
    };

    // This is the object that contains the information coming from the server.
    self.my_identity = randomString(20);
    self.my_board = new Array(64);
    self.game_in_progress = false;
    self.sunken_ships = 0;

    // This is the main control loop.
    function call_server() {
        //console.log("inside call_server");
        if (self.vue.chosen_magic_word === null) {
            console.log("No magic word.");
            self.vue.game_status = 'Choose a magic word and press play.';
            setTimeout(call_server, call_interval);
        } else {
            console.log("Calling server...");
            // We can do a server call.
            // Add a bit of random delay to avoid synchronizations.
            var extra_delay = Math.floor(Math.random() * 1000);
            $.ajax({
                dataType: 'json',
                url: server_url +'read',
                data: {key: self.vue.chosen_magic_word},
                success: self.process_server_data,
                complete: setTimeout(call_server, call_interval + extra_delay) // Here we go again.
            });
            //console.log("done with call");
        }
    }

    // Main function for sending the state.
    self.send_state = function () {
        //console.log("sending state: BOARD 1: " + self.vue.board_1 + ",     BOARD TWO: " + self.vue.board_2);
        console.log("sending state");
        $.post(server_url + 'store',
            {
                key: self.vue.chosen_magic_word,
                val: JSON.stringify(
                    {
                        'player_1': self.vue.player_1,
                        'player_2': self.vue.player_2,
                        "board_1": self.vue.board_1,
                        "board_2": self.vue.board_2,
                        'turn_counter': self.vue.turn_counter,
                        'game_counter': self.vue.game_counter,
                        'game_status': self.vue.game_status
                    }
                )
            }
        );
        //console.log("done sending");
    };

    self.take_server_state = function (server_answer) {
        console.log("taking server state");
        self.vue.player_1 = server_answer.player_1;
        self.vue.player_2 = server_answer.player_2;
        //if(server_answer.board_1 != null) {
        if( server_answer.board_1[1] !== 'x') {
            self.vue.board_1 = server_answer.board_1;
        }
        //}
        //if(server_answer.board_2 != null) {
        if( server_answer.board_2[1] !== 'x') {
            self.vue.board_2 = server_answer.board_2;
        }
        //}
        if(server_answer.game_status != 'GAME OVER. Play again?') {
            self.vue.turn_counter = server_answer.turn_counter;
        }
        self.vue.game_counter = server_answer.game_counter;
        for ( i = 0; i<64; i++){
            Vue.set(self.vue.board_1, i, server_answer.board_1[i]);
            Vue.set(self.vue.board_2, i, server_answer.board_2[i]);
        }
    };


    // Main place where we receive data and act on it.
    self.process_server_data = function (data) {
        //console.log("inside process server data.");
        // If data is null, we send our data.
        if (!data.result) {
            console.log("server data null, we send our data");
            self.vue.player_1 = self.my_identity;
            self.vue.player_2 = null;
            self.vue.board_1 = self.my_board;
            self.vue.board_2 = new Array(64);
            self.vue.is_my_turn = false;
            self.vue.turn_counter = 0;
            self.send_state();
        } else {
            // I technically don't need to assign this to self, but it helps debug the code.
            self.server_answer = JSON.parse(data.result);
            //console.log("Server answers: " + self.server_answer.player_1 + "," + self.server_answer.player_2);
            self.vue.player_1 = self.server_answer.player_1;
            self.vue.player_2 = self.server_answer.player_2;
            if (self.vue.player_1 === null || self.vue.player_2 === null) {
                //console.log("some player is missing");
                // Some player is missing. We cannot play yet.
                self.vue.is_my_turn = false;
                if (self.vue.player_1 === self.my_identity || self.vue.player_2 === self.my_identity) {
                    // We are already present, nothing to do.
                    //console.log("Waiting for other player to join");
                    self.vue.game_status = 'Waiting for another player...';
                } else {
                    //console.log("Signing up now.");
                    // We are not present.  Let's join if we can.
                    if (self.vue.player_1 === null) {
                        self.vue.game_status = 'Signing up as Player 1...';
                        //console.log("no player 1, we take the spot");
                        // Preferentially we play as 1.
                        self.vue.player_1 = self.my_identity;
                        self.vue.board_1 = self.my_board;
                        self.send_state();
                    } else if (self.vue.player_2 === null) {
                        self.vue.game_status = 'Signing up as Player 2...';
                        //console.log("no player 2, we take the spot");
                        self.vue.player_1 = self.server_answer.player_1;
                        self.vue.board_1 = self.server_answer.board_1;
                        self.vue.player_2 = self.my_identity;
                        self.vue.board_2 = self.my_board;
                        self.send_state();
                    } else {
                        self.vue.game_status = 'That magic word is not available. Pick another';
                        //console.log("magic word already taken");
                        // The magic word is already taken.
                        self.vue.need_new_magic_word = true;
                    }
                }
            } else {
                //console.log("Both players are present and ready");
                // Both players are present.
                // Let us determine our role if any.
                if (self.vue.player_2 !== self.my_identity && self.vue.player_1 !== self.my_identity) {
                    // Again, we are intruding in a game.
                    //console.log("neither 1st nor 2nd spot available");
                    self.vue.game_status = 'That magic word is not available. Pick another.';
                    self.vue.need_new_magic_word = true;
                } else {
                    // Here is the interesting code: we are playing, and the opponent is there.
                    // Reconciles the state.
                    self.vue.game_status = 'Both players present. Time to play!';
                    // if (self.game_in_progress == false && self.sunken_ships < 6){
                    //     self.vue.game_counter++;
                    //     self.vue.turn_counter = 0;
                    //     console.log("NEW GAME: #" + self.vue.game_counter);
                    //     self.game_in_progress = true;
                    // }
                    //console.log("time to play");
                    self.update_local_vars(self.server_answer);
                }
            }
        }
    };

    self.update_local_vars = function (server_answer) {

        if(server_answer.game_status === "GAME OVER. Play again?" && server_answer.game_counter == self.vue.game_counter){
            console.log("server informs us game over");
            self.vue.game_status = server_answer.game_status;
            self.game_in_progress = false;
            return;
        }

        var device_has_newer_state = false;

        if(self.sunken_ships == 6 && self.vue.game_status !== "GAME OVER. Play again?"){
            console.log("GAME OVER. All ships sunken.");
            self.game_in_progress = false;
            self.vue.game_status = "GAME OVER. Play again?";
            device_has_newer_state = true;
            self.send_state();
            return;
        }

        var i = 0;
        // First, figures out our role.
        if (server_answer.player_2 === self.my_identity) {
            self.vue.my_role = 'Player 2';
            self.vue.game_status = 'You are Player 2. Play on odd turns.';
            //console.log("take player 2 role");
        } else if (server_answer.player_1 === self.my_identity) {
            self.vue.my_role = 'Player 1';
            self.vue.game_status = 'You are Player 1. Play on even turns.';
            //console.log("take player 1 role");
        } else {
            self.vue.my_role = '';
        }


        // //Set up opponents boards on first turn
        if (self.vue.turn_counter === 0 && (self.vue.board_1 === null || self.vue.board_2 === null)){
            console.log("First turn.");
            for (i = 0; i<64; i++) {
                if (self.vue.my_role === 'Player 1') {
                    //Vue.set(self.vue.board_1, i, self.my_board[i]);
                    self.vue.board_2 = server_answer.board_2;
                    self.vue.game_status = "Start the game!"
                } else if (self.vue.my_role === 'Player 2') {
                    //Vue.set(self.vue.board_2, i, self.my_board[i]);
                    self.vue.board_1 = server_answer.board_1;
                    self.vue.game_status = "Opponent makes first move."
                }
            }
        }

        if((self.vue.turn_counter + 1) == server_answer.turn_counter && self.vue.game_counter > server_answer.game_counter){
            //device has newer state
            device_has_newer_state = true;
        } else if (self.vue.turn_counter == (server_answer.turn_counter - 1) || self.vue.game_counter < server_answer.game_counter){
            //server has newer state
            self.take_server_state(server_answer);
        } else {
            var board_inconsistency = false;

            //make sure boards are the same when turns are the same
            for ( i = 0; i<64; i++){
                if(self.vue.board_1[i] !== server_answer.board_1[i]) {
                    //console.log("Board 1 inconsistency at turn: " + self.vue.turn_counter);
                    board_inconsistency = true;
                }
                if (self.vue.board_2[i] !== server_answer.board_2[i]) {
                    //console.log("Board 2 inconsistency at turn: " + self.vue.turn_counter);
                    board_inconsistency = true;
                }
            }
            if (board_inconsistency === true){
                //take server's state by default when inconsistensies exist
                //get opponents board on first turn
                if(self.vue.turn_counter == 0){
                    if (self.vue.my_role === 'Player 1'){
                        self.vue.board_2 = server_answer.board_2;
                    } else {
                        self.vue.board_1 = server_answer.board_1;
                    }
                } else {
                    console.log("board inconsistency at turn " + self.vue.turn_counter);
                    //console.log("Device board 1: " + self.vue.board_1);
                    //console.log("Server board 1: " + server_answer.board_1);
                    //console.log("Device board 2: " + self.vue.board_2);
                    //console.log("Server board 2: " + server_answer.board_2);
                    self.take_server_state(server_answer);
                }
            }
        }

        // Compute whether it's my turn on the basis of the now reconciled board.
        self.vue.is_my_turn = (self.vue.board_1 !== null && self.vue.board_2 !== null) &&
            (self.vue.my_role === whose_turn(self.vue.turn_counter));

        // If we have newer state than the server, we send it to the server.
        if (device_has_newer_state) {
            self.send_state();
        }
    }

    function whose_turn(turn_counter) {
        if(turn_counter%2 === 0){
            return 'Player 1'; //turn is even. player 1 goes
        } else {
            return 'Player 2'; //turn is odd. player 2 goes
        }
    }


    self.set_magic_word = function () {
        if (self.vue.magic_word != self.vue.chosen_magic_word) { //leave current game, blank slate
            self.game_in_progress = false;
            self.vue.game_status = "Setting up new game...";
            self.vue.chosen_magic_word = self.vue.magic_word;
            self.vue.need_new_magic_word = false;
            // Resets board and turn.
            self.my_board = getBoard();        //have new board config available
            self.vue.is_my_turn = false;
            self.vue.my_role = "";
            self.vue.game_counter = 0;
            self.vue.turn_counter = 0;
            self.vue.player_1 = null;
            self.vue.player_2 = null;
            self.vue.is_other_present = false;
            self.sunken_ships = 0;
            for ( i = 0; i<64; i++){
                Vue.set(self.vue.board_1, i, "*");
                Vue.set(self.vue.board_2, i, "*");
            }
            console.log("blank slate for game");
        } else if (self.game_in_progress == false) { //start new game with same player
            console.log("new game with same player");
            self.vue.game_status = "Setting up new game with same player...";
            self.sunken_ships = 0;
            self.vue.turn_counter = 0;
            self.my_board = getBoard();        //have new board config available
            if(self.vue.my_role == 'Player 1'){
                self.vue.board_1 = self.my_board;
            } else {
                self.vue.board_2 = self.my_board;
            }
            self.vue.is_my_turn = false;
            self.vue.turn_counter = 0;
            self.vue.game_counter++;
            for ( i = 0; i<64; i++){
                if(self.vue.my_role == 'Player 1'){
                    Vue.set(self.vue.board_2, i, "x");
                } else {
                    Vue.set(self.vue.board_1, i, "x");
                }
            }
            self.send_state();
        } else {
            console.log("need to finish current game before starting new one with same key and player");
        }
    };

    self.play = function (i, j, board_num ) {
        // Check that the game is ongoing and that it's our turn to play.
        if (!self.vue.is_my_turn) {
            return;
        }

        var newBoard = getBoard();
        if(board_num == 1 && self.vue.board_1[i*8+j] == 'x'){
            for ( k = 0; k<64; k++){
                Vue.set(self.vue.board_1, k, newBoard[k]);
            }
        }
        if(board_num == 2 && self.vue.board_2[i*8+j] == 'x'){
            for ( k = 0; k<64; k++){
                Vue.set(self.vue.board_2, k, newBoard[k]);
            }
        }

        console.log(self.vue.my_role + " clicked on i,j: " + i + ", " + j);

        // // Check also that the square hasn't been hit yet
        if (board_num == 1){
            //console.log("clicked on board 1, value of " + self.vue.board_1[i * 8 + j] );
            if (self.vue.board_1[i * 8 + j] !== "*" && self.vue.board_1[i * 8 + j] < 0) {
                return;
            }
        } else if (board_num == 2) {
            //console.log("clicked on board 2, value of " + self.vue.board_2[i * 8 + j] );
            if (self.vue.board_2[i * 8 + j] !== "*" && self.vue.board_2[i * 8 + j] < 0) {
                return;
            }
        }

        //check if hitting opponents
        if (self.vue.my_role === 'Player 1' && board_num === 2) {
            if(self.vue.board_2[i * 8 + j] == "*"){
                //console.log("hit correct board, at *. i*8+j is " + (i*8+j) + ", with a value" + self.vue.board_2[i*8+j]);
                Vue.set(self.vue.board_2, i * 8 + j, "0");
            } else {
                //console.log("hit correct board, at not *. i*8+j is " + (i*8+j) + ", with a value" + self.vue.board_2[i*8+j]);
                Vue.set(self.vue.board_2, i * 8 + j, "-" + self.vue.board_2[i * 8 + j]);
            }
        } else if (self.vue.my_role === 'Player 2' && board_num === 1){
            if(self.vue.board_1[i * 8 + j] == "*"){
                //console.log("hit correct board, at *. i*8+j is " + (i*8+j) + ", with a value" + self.vue.board_1[i*8+j]);
                Vue.set(self.vue.board_1, i * 8 + j, "0");
            } else {
                //console.log("hit correct board, at not *. i*8+j is " + (i*8+j) + ", with a value" + self.vue.board_1[i*8+j]);
                Vue.set(self.vue.board_1, i * 8 + j,  "-" + self.vue.board_1[i * 8 + j]);
            }
        } else {
            return;
        }

        //check if whole ship sunk, mark perimeter
        if (board_num == 2){
            self.check_perimeter(self.vue.board_2,i,j);
        } else if (board_num == 1){
            self.check_perimeter(self.vue.board_1,i,j);

        }


        self.vue.turn_counter++;
        self.vue.is_my_turn = false;
        self.send_state();
    };

    self.check_perimeter = function(board, i,j){
        //console.log("checking perimeters:" + "right, left, up, down: " + board[i*8 + j + 1] + board[i*8 + j - 1] +board[(i-1)*8 + j] +board[(i+1)*8 + j]);
        if (board[i * 8 + j] == '-2' || board[i * 8 + j] == '-3' || board[i * 8 + j] == '-4') { //one square ships
            self.sunken_ships++;
            if (self.vue.my_role == 'Player 1') {
                if(j%8 !== 7) {
                    Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //check right
                }
                if(j%8 !== 0) {
                    Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //check left
                }
                if(i !== 0) {
                    Vue.set(self.vue.board_2, (i - 1) * 8 + j, 0); //check up
                }
                if(i !== 7) {
                    Vue.set(self.vue.board_2, (i + 1) * 8 + j, 0); //check down
                }
                console.log("player 1 sunk 1 sq boat");
            }else{
                if(j%8 !== 7) {
                    Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //check right
                }
                if(j%8 !== 0) {
                    Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //check left
                }
                if(i !== 0) {
                    Vue.set(self.vue.board_1, (i - 1) * 8 + j, 0); //check up
                }
                if(i !== 7) {
                    Vue.set(self.vue.board_1, (i + 1) * 8 + j, 0); //check down
                }
                console.log("player 2 sunk 1 sq boat");

            }
            //console.log("1 square ship sunk! Number: " + board[i * 8 + j] + "peripheral vals right, left, up down: " + board[i * 8 + j - 1] + board[i * 8 + j + 1] +board[(i+1)*8 + j] +board[(i-1)*8 + j]);
        } else if (board[i * 8 + j] == -5 || board[i * 8 + j] == -6 ){ //two square ships
            //console.log("Hit a two square ship.");
            if((board[i * 8 + j - 1] == -5 || board[i * 8 + j - 1] == -6) && j%8 != 0){ //check left
                self.sunken_ships++;
                if (self.vue.my_role === 'Player 1') {
                    if(j%8 != 7){
                        Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                    }
                    if(j%8 != 1){
                        Vue.set(self.vue.board_2, i * 8 + j - 2, 0); //set left, skipped over
                    }
                    if( i != 0) {
                        Vue.set(self.vue.board_2, (i-1)*8 + j, 0); //set up
                        Vue.set(self.vue.board_2, (i-1)*8 + j - 1, 0); //set up, same ship
                    }
                    if( i != 7) {
                        Vue.set(self.vue.board_2, (i+1)*8 + j, 0); //set down
                        Vue.set(self.vue.board_2, (i+1)*8 + j - 1, 0); //set down, same ship
                    }
                }else{ //Player 2 hits board 1:
                    if(j%8 != 7){
                        Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                    }
                    if(j%8 != 1){
                        Vue.set(self.vue.board_1, i * 8 + j - 2, 0); //set left, skipped over
                    }
                    if( i != 0) {
                        Vue.set(self.vue.board_1, (i-1)*8 + j, 0); //set up
                        Vue.set(self.vue.board_1, (i-1)*8 + j - 1, 0); //set up, same ship
                    }
                    if( i != 7) {
                        Vue.set(self.vue.board_1, (i+1)*8 + j, 0); //set down
                        Vue.set(self.vue.board_1, (i+1)*8 + j - 1, 0); //set down, same ship
                    }
                }
            } else if ((board[i * 8 + j + 1] == -5  || board[i * 8 + j + 1] == -6) && j%8 != 7) { //check right
                self.sunken_ships++;
                if (self.vue.my_role === 'Player 1') {
                    if(j%8 != 6){
                        Vue.set(self.vue.board_2, i * 8 + j + 2, 0); //right skip over
                    }
                    if(j%8 != 0){
                        Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                    }
                    if( i != 0) {
                        Vue.set(self.vue.board_2, (i-1)*8 + j, 0); //set up
                        Vue.set(self.vue.board_2, (i-1)*8 + j + 1, 0); //set up of same ship square
                    }
                    if( i != 7) {
                        Vue.set(self.vue.board_2, (i+1)*8 + j, 0); //set down
                        Vue.set(self.vue.board_2, (i+1)*8 + j + 1, 0); //set down of same ship square
                    }
                }else{ //Player 2 hits board 1
                    if(j%8 != 6){
                        Vue.set(self.vue.board_1, i * 8 + j + 2, 0); //right skip over
                    }
                    if(j%8 != 0){
                        Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                    }
                    if( i != 0) {
                        Vue.set(self.vue.board_1, (i-1)*8 + j, 0); //set up
                        Vue.set(self.vue.board_1, (i-1)*8 + j + 1, 0); //set up of same ship square
                    }
                    if( i != 7) {
                        Vue.set(self.vue.board_1, (i+1)*8 + j, 0); //set down
                        Vue.set(self.vue.board_1, (i+1)*8 + j + 1, 0); //set down of same ship square
                    }
                }
            } else if ((board[(i+1)*8 + j] == -5  || board[(i+1)*8 + j] == -6) && ((i+1) != undefined)) { //check down
                self.sunken_ships++;
                if (self.vue.my_role === 'Player 1') {
                    if(j%8 != 7){
                        Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                        Vue.set(self.vue.board_2, (i+1)*8 + j + 1, 0); //set right of same ship square
                    }
                    if(j%8 != 0){
                        Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                        Vue.set(self.vue.board_2, (i+1)*8 + j - 1, 0); //set right of same ship square
                    }
                    if( i != 0) {
                        Vue.set(self.vue.board_2, (i-1)*8 + j, 0); //set up
                    }
                    if( i != 6) {
                        Vue.set(self.vue.board_2, (i+2)*8 + j, 0); // set down skip over
                    }
                }else{
                    if(j%8 != 7){
                        Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                        Vue.set(self.vue.board_1, (i+1)*8 + j + 1, 0); //set right same ship square
                    }
                    if(j%8 != 0){
                        Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                        Vue.set(self.vue.board_1, (i+1)*8 + j - 1, 0); //set left same ship square
                    }
                    if( i != 0) {
                        Vue.set(self.vue.board_1, (i-1)*8 + j, 0); //set up
                    }
                    if( i != 6) {
                        Vue.set(self.vue.board_1, (i+2)*8 + j, 0); // set down skip over
                    }
                }
            } else if ((board[(i-1)*8+ j] == -5  || board[(i-1)*8+ j] == -6 ) && ((i-1)!= undefined)){ //check up
                self.sunken_ships++;
                if (self.vue.my_role === 'Player 1') {
                    if(j%8 != 7) {
                        Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                        Vue.set(self.vue.board_2, (i-1)*8 + j + 1, 0); //same ship
                    }
                    if(j%8 != 0) {
                        Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                        Vue.set(self.vue.board_2, (i-1)*8 + j - 1, 0); //same ship
                    }
                    if(i != 7) {
                        Vue.set(self.vue.board_2, (i + 1) * 8 + j, 0); //set down
                    }
                    if(i != 1) {
                        Vue.set(self.vue.board_2, (i - 2) * 8 + j, 0); //up skip over
                    }
                }else{
                    if(j%8 != 7) {
                        Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                        Vue.set(self.vue.board_1, (i-1)*8 + j + 1, 0); //same ship
                    }
                    if(j%8 != 0) {
                        Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                        Vue.set(self.vue.board_1, (i-1)*8 + j - 1, 0); //same ship
                    }
                    if(i != 7) {
                        Vue.set(self.vue.board_1, (i + 1) * 8 + j, 0); //set down
                    }
                    if(i != 1) {
                        Vue.set(self.vue.board_1, (i - 2) * 8 + j, 0); //up skip over
                    }
                }
            }
        } else if (board[i * 8 + j] == -1){ //three square ship
            //console.log("hit a three square ship. right, left, up, down vals: " + board[i * 8 + j + 1] + board[i * 8 + j - 1] + board[(i-1) * 8 + j] + board[(i+1) * 8 + j]);
            if(board[ (i*8) + j-1 ] == -1 || board[ (i*8)+ j+1 ] == -1) {//check and right or left
                //console.log("same ship horizontal!");
                //two on right
                if (board[(i)*8+ j - 1] == -1 && board[(i)*8+ j - 2] == -1){ //two on left
                    self.sunken_ships++;
                    if(self.vue.my_role == 'Player 1') { //player 1, change board 2
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_2, (i-1) * 8 + j, 0); //set up
                            Vue.set(self.vue.board_2, (i-1) * 8 + j - 1, 0); //set up, same ship one left
                            Vue.set(self.vue.board_2, (i-1) * 8 + j - 2, 0); //set up, same ship two left
                        }
                        if( i != 7) { //check no down space
                            Vue.set(self.vue.board_2, (i+1) * 8 + j, 0); //set down
                            Vue.set(self.vue.board_2, (i+1) * 8 + j - 1, 0); //set down, same ship one left
                            Vue.set(self.vue.board_2, (i+1) * 8 + j - 2, 0); //set down, same ship two left
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                        }
                        if(j%8 != 2) { //check no left space by two
                            Vue.set(self.vue.board_2, i * 8 + j - 3, 0); //set left over two
                        }
                    } else { //player 2, change board 1
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_1, (i-1) * 8 + j, 0); //set up
                            Vue.set(self.vue.board_1, (i-1) * 8 + j - 1, 0); //set up, same ship one left
                            Vue.set(self.vue.board_1, (i-1) * 8 + j - 2, 0); //set up, same ship two left
                        }
                        if( i != 7) { //check no down space
                            Vue.set(self.vue.board_1, (i+1) * 8 + j, 0); //set down
                            Vue.set(self.vue.board_1, (i+1) * 8 + j - 1, 0); //set down, same ship one left
                            Vue.set(self.vue.board_1, (i+1) * 8 + j - 2, 0); //set down, same ship two left
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                        }
                        if(j%8 != 2) { //check no left space by two
                            Vue.set(self.vue.board_1, i * 8 + j - 3, 0); //set left over two
                        }
                    }
                } else if (board[(i)*8+ j + 1] == -1 && board[(i)*8+ j + 2] == -1){ //two on right
                    self.sunken_ships++;
                    if(self.vue.my_role == 'Player 1') { //player 1, change board 2
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_2, (i-1) * 8 + j, 0); //set up
                            Vue.set(self.vue.board_2, (i-1) * 8 + j + 1, 0); //set up, same ship one right
                            Vue.set(self.vue.board_2, (i-1) * 8 + j + 2, 0); //set up, same ship two right
                        }
                        if ( i != 7) { //check no down space
                            Vue.set(self.vue.board_2, (i+1) * 8 + j, 0); //set down
                            Vue.set(self.vue.board_2, (i+1) * 8 + j + 1, 0); //set down, same ship one right
                            Vue.set(self.vue.board_2, (i+1) * 8 + j + 2, 0); //set down, same ship two right
                        }
                        if ( j%8 != 5) { //check no right space by two
                            Vue.set(self.vue.board_2, i * 8 + j + 3, 0); //set right over two
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                        }
                    } else { //player 2, change board 1
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_1, (i-1) * 8 + j, 0); //set up
                            Vue.set(self.vue.board_1, (i-1) * 8 + j + 1, 0); //set up, same ship one right
                            Vue.set(self.vue.board_1, (i-1) * 8 + j + 2, 0); //set up, same ship two right
                        }
                        if ( i != 7) { //check no down space
                            Vue.set(self.vue.board_1, (i+1) * 8 + j, 0); //set down
                            Vue.set(self.vue.board_1, (i+1) * 8 + j + 1, 0); //set down, same ship one right
                            Vue.set(self.vue.board_1, (i+1) * 8 + j + 2, 0); //set down, same ship two right
                        }
                        if ( j%8 != 5) { //check no right space by two
                            Vue.set(self.vue.board_1, i * 8 + j + 3, 0); //set right over two
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                        }
                    }
                } else if(board[(i)*8+ j - 1] == -1 && board[(i)*8+ j + 1] == -1) { //one right one left
                    self.sunken_ships++;
                    if (self.vue.my_role == 'Player 1') { //player 1, change board 2
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_2, (i - 1) * 8 + j, 0); //set up
                            Vue.set(self.vue.board_2, (i - 1) * 8 + j - 1, 0); //set up, same ship one left
                            Vue.set(self.vue.board_2, (i - 1) * 8 + j + 1, 0); //set up, same ship one right
                        }
                        if (i != 7) { //check no down space
                            Vue.set(self.vue.board_2, (i + 1) * 8 + j, 0); //set down
                            Vue.set(self.vue.board_2, (i + 1) * 8 + j - 1, 0); //set down, same ship one left
                            Vue.set(self.vue.board_2, (i + 1) * 8 + j + 1, 0); //set down, same ship one right
                        }
                        if (j % 8 != 1) { //check no left space by one
                            Vue.set(self.vue.board_2, i * 8 + j - 2, 0); //set left over one
                        }
                        if (j % 8 != 6) { //check no right space by one
                            Vue.set(self.vue.board_2, i * 8 + j + 2, 0); //set right over one
                        }
                    } else { //player 2, change board 1
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_1, (i - 1) * 8 + j, 0); //set up
                            Vue.set(self.vue.board_1, (i - 1) * 8 + j - 1, 0); //set up, same ship one left
                            Vue.set(self.vue.board_1, (i - 1) * 8 + j + 1, 0); //set up, same ship one right
                        }
                        if (i != 7) { //check no down space
                            Vue.set(self.vue.board_1, (i + 1) * 8 + j, 0); //set down
                            Vue.set(self.vue.board_1, (i + 1) * 8 + j - 1, 0); //set down, same ship one left
                            Vue.set(self.vue.board_1, (i + 1) * 8 + j + 1, 0); //set down, same ship one right
                        }
                        if (j % 8 != 1) { //check no left space by one
                            Vue.set(self.vue.board_1, i * 8 + j - 2, 0); //set left over one
                        }
                        if (j % 8 != 6) { //check no right space by one
                            Vue.set(self.vue.board_1, i * 8 + j + 2, 0); //set right over one
                        }
                    }
                }
            }
            if (board[(i-1)*8+ j] == -1 || board[(i+1)*8+ j] == -1){ //check any up or down
                //console.log("same ship vertical!");
                if (board[(i - 1)*8+ j] == -1 && board[(i - 2)*8+ j] == -1) { //two up
                    self.sunken_ships++;
                    //console.log("two up");
                    if(self.vue.my_role == 'Player 1') { //player 1, change board 2
                        if (i != 2) { //check no up space by two
                            Vue.set(self.vue.board_2, (i-3) * 8 + j, 0); //set up over two
                        }
                        if( i != 7) { //check no down space
                            Vue.set(self.vue.board_2, (i+1) * 8 + j, 0); //set down
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                            Vue.set(self.vue.board_2, (i-1) * 8 + j + 1, 0); //set right, same ship one up
                            Vue.set(self.vue.board_2, (i-2) * 8 + j + 1, 0); //set right, same ship two up
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                            Vue.set(self.vue.board_2, (i-1) * 8 + j - 1, 0); //set left, same ship one up
                            Vue.set(self.vue.board_2, (i-2) * 8 + j - 1, 0); //set left, same ship two up
                        }
                    } else { //player 2, change board 1
                        if (i != 2) { //check no up space by two
                            Vue.set(self.vue.board_1, (i-3) * 8 + j, 0); //set up over two
                        }
                        if( i != 7) { //check no down space
                            Vue.set(self.vue.board_1, (i+1) * 8 + j, 0); //set down
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                            Vue.set(self.vue.board_1, (i-1) * 8 + j + 1, 0); //set right, same ship one up
                            Vue.set(self.vue.board_1, (i-2) * 8 + j + 1, 0); //set right, same ship two up
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                            Vue.set(self.vue.board_1, (i-1) * 8 + j - 1, 0); //set left, same ship one up
                            Vue.set(self.vue.board_1, (i-2) * 8 + j - 1, 0); //set left, same ship two up
                        }
                    }
                } else if (board[(i + 1)*8+ j] == -1 && board[(i + 2)*8+ j] == -1){ //two down
                    self.sunken_ships++;
                    //console.log("two down");
                    if(self.vue.my_role == 'Player 1') { //player 1, change board 2
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_2, (i-1) * 8 + j, 0); //set up
                        }
                        if( i != 5) { //check no down space by two
                            Vue.set(self.vue.board_2, (i+3) * 8 + j, 0); //set down over two
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                            Vue.set(self.vue.board_2, (i+1) * 8 + j + 1, 0); //set right, same ship one down
                            Vue.set(self.vue.board_2, (i+2) * 8 + j + 1, 0); //set right, same ship two down
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                            Vue.set(self.vue.board_2, (i+1) * 8 + j - 1, 0); //set left, same ship one down
                            Vue.set(self.vue.board_2, (i+2) * 8 + j - 1, 0); //set left, same ship two down
                        }
                    } else { //player 2, change board 1
                        if (i != 0) { //check no up space
                            Vue.set(self.vue.board_1, (i-1) * 8 + j, 0); //set up
                        }
                        if( i != 5) { //check no down space by two
                            Vue.set(self.vue.board_1, (i+3) * 8 + j, 0); //set down over two
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                            Vue.set(self.vue.board_1, (i+1) * 8 + j + 1, 0); //set right, same ship one down
                            Vue.set(self.vue.board_1, (i+2) * 8 + j + 1, 0); //set right, same ship two down
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                            Vue.set(self.vue.board_1, (i+1) * 8 + j - 1, 0); //set left, same ship one down
                            Vue.set(self.vue.board_1, (i+2) * 8 + j - 1, 0); //set left, same ship two down
                        }
                    }
                } else if (board[(i - 1)*8+ j] == -1 && board[(i + 1)*8+ j] == -1){ //one up one down
                    self.sunken_ships++;
                    //console.log("one up one down");
                    if(self.vue.my_role == 'Player 1') { //player 1, change board 2
                        if (i != 1) { //check no up space by one
                            Vue.set(self.vue.board_2, (i-2) * 8 + j, 0); //set up over one
                        }
                        if( i != 6) { //check no down space by one
                            Vue.set(self.vue.board_2, (i+2) * 8 + j, 0); //set down over one
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_2, i * 8 + j + 1, 0); //set right
                            Vue.set(self.vue.board_2, (i+1) * 8 + j + 1, 0); //set right, same ship one down
                            Vue.set(self.vue.board_2, (i-1) * 8 + j + 1, 0); //set right, same ship one up
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_2, i * 8 + j - 1, 0); //set left
                            Vue.set(self.vue.board_2, (i+1) * 8 + j - 1, 0); //set left, same ship one down
                            Vue.set(self.vue.board_2, (i-1) * 8 + j - 1, 0); //set left, same ship one up
                        }
                    } else { //player 2, change board 1
                        if (i != 1) { //check no up space by one
                            Vue.set(self.vue.board_1, (i-2) * 8 + j, 0); //set up over one
                        }
                        if( i != 6) { //check no down space by one
                            Vue.set(self.vue.board_1, (i+2) * 8 + j, 0); //set down over one
                        }
                        if ( j%8 != 7) { //check no right space
                            Vue.set(self.vue.board_1, i * 8 + j + 1, 0); //set right
                            Vue.set(self.vue.board_1, (i+1) * 8 + j + 1, 0); //set right, same ship one down
                            Vue.set(self.vue.board_1, (i-1) * 8 + j + 1, 0); //set right, same ship one up
                        }
                        if(j%8 != 0) { //check no left space
                            Vue.set(self.vue.board_1, i * 8 + j - 1, 0); //set left
                            Vue.set(self.vue.board_1, (i + 1) * 8 + j - 1, 0); //set left, same ship one down
                            Vue.set(self.vue.board_1, (i - 1) * 8 + j - 1, 0); //set left, same ship one up
                        }
                    }
                }
            }
        }

    };


    self.vue = new Vue({
        el: "#vue-div",
        delimiters: ['${', '}'],
        unsafeDelimiters: ['!{', '}'],
        data: {
            player_1: null,
            player_2: null,
            magic_word: "",
            chosen_magic_word: null,
            need_new_magic_word: false,
            my_role: "",
            board_1: new Array(64),
            board_2: new Array(64),
            is_other_present: false,
            is_my_turn: false,
            game_counter: 0,
            turn_counter: 0,
            game_status: ""
        },
        methods: {
            set_magic_word: self.set_magic_word,
            play: self.play,
            squareColor: function(squareValue, board_owner) {
                return {blue: squareValue == 0, green: squareValue > 0 && this.my_role == board_owner,
                    red: squareValue < 0}
            }
        }

    });

    call_server();

    return self;
};

var APP = null;

// This will make everything accessible from the js console;
// for instance, self.x above would be accessible as APP.x
jQuery(function(){
    APP = app();
    APP.initialize();
});




















//--------------------BOARD CREATOR:-------------------------

//checks for valid placement of ship of ship_size in a board_size x board_size at (x,y) with orientatation (0->horizontal, 1-> vertical)
function isvalid(board, x, y, orientation, ship_size, board_size){
    if(orientation){
        if(x+ship_size >= board_size) return false;
        for(var i = x; i < x+ship_size; i++){
            if(board[i][y] !== '*' ||
                (y-1 >= 0 && board[i][y-1] !== '*') || // to ensure that ships do not "touch each other"
                (y+1 < board_size && board[i][y+1] !== '*'))
                return false;
        }
        if((x - 1 >= 0 && board[x-1][y] !== '*') ||
            (x + ship_size < board_size && board[x+ship_size][y] !== '*')) return false;
    } else {
        if(y+ship_size >= board_size) return false;
        for(var i = y; i < y+ship_size; i++){
            if(board[x][i] !== '*' ||
                (x-1 >= 0 && board[x-1][i] !== '*') || // to ensure that ships do not "touch each other"
                (x+1 < board_size && board[x+1][i] !== '*'))
                return false;
        }
        if((y-1 >= 0 && board[x][y-1] !== '*') ||
            (y+ship_size < board_size && board[x][y+ship_size] !== '*')) return false;
    }
    return true;
}

function print(board){
    var size = Math.sqrt(board.length);
    for(var i = 0; i < size; i++){
        var s = "";
        for(var j = 0; j < size; j++){
            s += board[i*size + j];
        }
        console.log(s);
    }
}

//creates a ship in board with shipid
function setShip(board, orientation, x, y, ship_size, shipid){
    if(orientation){
        for(var i = x; i < x+ship_size; i++){
            board[i][y] = shipid;
        }
    }else{
        for(var i = y; i < y+ship_size; i++){
            board[x][i] = shipid;
        }
    }
}

//get random integers in range [Min, Max]
function get_random(Min, Max){
    return Math.floor(Math.random() * (Max - Min +1)) + Min;
}

//create a ship
function createShip(board, board_size, ship_size, shipid){
    var counter=0;
    while(counter < 200){
        counter++;
        var orientation = get_random(0, 1);//0 -> horizontal, 1-> vertical
        var x=0;
        var y=0;
        if(orientation){
            x = get_random(0, board_size-ship_size-1);
            y = get_random(0, board_size-1);
        }else{
            x = get_random(0, board_size-1);
            y = get_random(0, board_size-ship_size-1);
        }
        if(!isvalid(board, x, y, orientation, ship_size, board_size)) continue; //check if it conflicts
        setShip(board, orientation, x, y, ship_size, shipid);
        break;
    }
}

//create all ships
function createShips(board, board_size){
    var ships = [[1,3], [3,1], [2,2]]; // first element of every pair is number of ships, second element is length of ship
    var shipid = 1;
    for(var i = 0; i < ships.length; i++){
        for(var count = 0; count < ships[i][0]; count++){
            createShip(board, board_size, ships[i][1], shipid);
            shipid++;
        }
    }
}

//flatten 2d vector to 1d vector
function flatten(board){
    var size = board.length;
    var board2 = new Array(size*size);
    for(var i = 0; i < size; i++){
        for(var j = 0; j < size; j++)
            board2[i*size + j] = board[i][j];
    }
    return board2;
}

// get 8x8 board flattened
function getBoard(){
    var size = 8;
    var board = new Array(size);
    for (var i = 0; i < size; i++) {
        board[i] = new Array(size);
        for (var j = 0; j < size; j++)
            board[i][j] = '*';
    }
    createShips(board, size);
    board = flatten(board);
    return board;
}