// server/models/promptModel.js
class Prompt {
    constructor(username, text) {
        this.username = username;
        this.text = text;
        this.answers = [];
        this.votes = 0;
    }
}

module.exports = Prompt;