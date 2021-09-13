import * as fs from "fs";

import { Client, Intents } from "discord.js";
import { Command, CommandFile } from "./types";
import { indexBy, map, values } from "ramda";

import Bluebird from "bluebird";
import { REST } from "@discordjs/rest";
import { Routes } from "discord-api-types/v9";

const { BOT_TOKEN } = process.env;
const clientId = "886746688537133086";
const guildId = "886742237982113843";

async function main() {
  const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

  const commandFileNames = fs
    .readdirSync("./commands")
    .filter((file) => file.endsWith(".ts"));

  const commandFiles: CommandFile[] = map(
    (fileName) => require(`./commands/${fileName}`),
    commandFileNames
  );

  const commands: { [name: string]: Command } = indexBy(
    ({ data: { name } }) => name,
    await Bluebird.map(commandFiles, ({ getCommand }) => getCommand())
  );

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      const command = commands[interaction.commandName];
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: "There was an error while executing this command!",
          ephemeral: true,
        });
      }
    } else if (interaction.isButton()) {
      const commandName = interaction.customId.split(":")[0];
      const command = commands[commandName];
      if (!command) return;

      try {
        await command.executeButton(interaction);
      } catch (error) {
        console.error(error);
        await interaction.reply({
          content: "There was an error while executing this button!",
          ephemeral: true,
        });
      }
    }
  });

  const rest = new REST({ version: "9" }).setToken(BOT_TOKEN);

  (async () => {
    try {
      console.log("Started refreshing application (/) commands.");

      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: map(({ data }) => data, values(commands)),
      });

      console.log("Successfully reloaded application (/) commands.");
    } catch (error) {
      console.error(error);
    }
  })();

  client.login(BOT_TOKEN);
}

main();
