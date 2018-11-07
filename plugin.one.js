'use strict';

const fs = require('fs');
const readline = require('readline');
const GraphemeSplitter = require('grapheme-splitter');

const config = require('./config');

const splitter = new GraphemeSplitter();

module.exports = (bot, event, playerEvent, env) => {
    const chars = [];

    const findChar = (obj) => {
        for (const i in chars) {
            if (
                obj.text === chars[i].text
                && obj.from_id === chars[i].from_id
            ) {
                return i;
            }
        }

        return null;
    };

    readline.createInterface({
        input: fs.createReadStream(config.onePathChars),
    }).on('line', (line) => {
        const obj = JSON.parse(line);

        if (obj.del) {
            chars.splice(findChar(obj), 1);
        } else {
            chars.push(obj);
        }
    });

    const fdChars = fs.openSync(config.onePathChars, 'a');

    const addChar = (obj) => {
        const found = findChar(obj);

        if (obj.del) {
            if (found === null) {
                return;
            }

            chars.splice(found, 1);
        } else {
            if (found !== null) {
                return;
            }

            chars.push(obj);
        }

        fs.write(fdChars, JSON.stringify(obj) + '\n', () => {
            // nothing
        });
    };

    bot.onText(/^.{1,4}$/, event((msg, match) => {
        if (splitter.splitGraphemes(msg.text).length !== 1) {
            return;
        }

        if (msg.forward_from) {
            addChar({
                text: msg.text,
                from_id: msg.forward_from.id,
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                del: false,
            });
        } else {
            addChar({
                text: msg.text,
                from_id: msg.from.id,
                chat_id: msg.chat.id,
                message_id: msg.message_id,
                del: false,
            });
        }
    }, -1));

    bot.onText(/^\/one(@\w+)?(?: (.+))?$/, event((msg, match) => {
        const text = splitter.splitGraphemes(match[2] || msg.reply_to_message && msg.reply_to_message.text || '');
        const selected = [];

        if (text.length > config.oneMaxLength) {
            return;
        }

        for (const i in text) {
            const options = [];

            for (const j in chars) {
                if (chars[j].text === text[i]) {
                    options.push(chars[j]);
                }
            }

            if (options.length) {
                selected.push(options[Math.floor(Math.random() * options.length)]);
            }
        }

        const send = () => {
            if (selected.length) {
                const option = selected.shift();

                bot.forwardMessage(
                    msg.chat.id,
                    option.chat_id,
                    option.message_id
                ).catch((err) => {
                    option.del = true;
                    addChar(option);
                    send();
                }).then(send);
            }
        };

        send();
    }, 1));
};