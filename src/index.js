require("dotenv").config();
require("moment-duration-format");

for (const r of [ "TOKEN", "log", "DEV_TIME", "GUILD_ID", "DAYS", "ACTION_TYPE" ]) {
    if(!process.env[r] || typeof process.env[r] !== "string") return ((name) => {
        console.log(`[PROCESS:ERROR]: Property (${name}) isn't in the .env file, or isn't a string!`);
        return process.exit(1);
    })(r);
    if(r === "DAYS") {
        let parse = parseInt(process.env[r]);
        if(isNaN(parse)) process.env[r] = "0";
    } 
    if (r === "log") {
        if(!process.env[r].match(/http(s)?:\/\/(www.|canary.|ptb.)?discord(app)?.com\/api\/(v{1,9}\/)?webhooks\//gi)) {
            console.log(`[PROCESS:ERROR]: Property (${r}) doesn't follow the discord webhook url (https://discord.com/api/webhooks/ or https://discord.com/api/v8/webhooks/)`);
            return process.exit(1);
        }
    };
    if(r === "ACTION_TYPE") {
        if(!["kick", "ban"].includes(process.env[r].toLowerCase())) {
            console.log(`[PROCESS:ERROR]: Property (${r}) needs to be either (kick) or (ban)`);
            return process.exit(1);
        }
    }

};
const [ { Client }, defaultReason ] = [
    require("discord.js"),
    `Account age was below ${process.env.DAYS ?? 0} day(s)`
];

module.exports = new (class AutoMod extends Client {
    constructor(){
        super({
            fetchAllMembers: true,
            ws: {
                intents: [
                    "GUILDS",
                    "GUILD_BANS",
                    "GUILD_MEMBERS",
                    "GUILD_PRESENCES",
                ],
                properties: {
                    $browser: "Discord Android"
                }
            },
            presence: {
                status: "dnd",
                activity: {
                    name: `Fools get banned.`,
                    type: "WATCHING"
                }
            }
        });
        this.login(process.env.TOKEN).then(() => this.console(`[CLIENT]: Connected`));
        this.on("ready", () => this.console(`[CLIENT:READY]: ${this.user.tag} (${this.user.id}) is ready!`));
        this.on("guildMemberAdd", async (member) => {
            if(!member || !member.guild.available) return null;
            if(member.guild.id !== process.env.GUILD_ID) return null;
            let [ duration, parse ] = [
                require("moment").duration(new Date().getTime() - new Date(member.user.createdAt).getTime()).format("d"),
                parseInt(process.env.DAYS ?? 0)
            ]
            if(isNaN(parse)) parse = 0;
            if(duration <= parse) {
                this.console(`[GUILD:${member.guild.name}]: (ALERT) Member joined: ${member.user.tag} (${member.id}) has joined with ${duration} days.`);
                return this.action(member, defaultReason, process.env.ACTION_TYPE ?? "Ban");
            };
        });
    };
    /**
     * @param {import("discord.js").GuildMember} member 
     */
    async action(member, reason = defaultReason, action = "Ban") {
        const log = async () => {
            return new (require("discord-hook"))(process.env.log, { username: member.guild.name, avatar_url: member.guild.iconURL({ format: "png" }) })
            .embed({
                thumbnail: { url: member.user.displayAvatarURL({ dynamic: true }) },
                timestamp: new Date(),
                color: action.toLowerCase() === "ban" ? 0xFF0000 : 0xff8300,
                author: {
                    name: this.user.tag,
                    icon_url: this.user.displayAvatarURL({ dynamic: true }),
                    url: `https://superchiefyt.xyz/support`
                },
                title: `Action: ${action}`,
                fields: [
                    {
                        name: "User",
                        value: `${member.toString()}\n(${member.id})`,
                        inline: true
                    },
                    {
                        name: "Moderator",
                        value: `${this.user.toString()}\n(${this.user.id})`,
                        inline: true
                    },
                    {
                        name: "Reason",
                        value: reason ?? defaultReason,
                        inline: false
                    }
                ]
            })
            .send().catch(() => {});
        }
        if(action.toLowerCase() === "ban") {
            if(member.guild.me.permissions.has("BAN_MEMBERS")) {
                member.guild.members.ban(member.id, { reason, days: 7 })
                .then(() => {
                    this.console(`[GUILD:${member.guild.name}]: Member banned: ${member.user.tag} (${member.id}) | ${reason}`);
                    return log();
                })
                .catch(err => this.console(`[GUILD:${member.guild.name}]: Member ban failed: ${member.user.tag} (${member.id}) | ${err.message}`));
            }
        }else 
        if(action.toLowerCase() === "kick") {
            if(member.guild.me.permissions.has("KICK_MEMBERS")) {
                member.kick(reason)
                .then(() => {
                    this.console(`[GUILD:${member.guild.name}]: Member kicked: ${member.user.tag} (${member.id}) | ${reason}`);
                    return log();
                })
                .catch(err => this.console(`[GUILD:${member.guild.name}]: Member kick failed: ${member.user.tag} (${member.id}) | ${err.message}`));
            }
        }
    };
    console(...args) {
        return console.log(`[${new Date().toLocaleString("en-US", { timeZone: process.env.DEV_TIME })}]:`, ...args);
    };
})()