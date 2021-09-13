import { CommandInteraction, MessageEmbed } from "discord.js";
import {
  Leaderboard,
  Run,
  getGameCategories,
  getLeaderboard,
} from "../lib/speedrun";
import { addIndex, join, map, reduce } from "ramda";

import { Command } from "../types";
import { SlashCommandBuilder } from "@discordjs/builders";

const WA_GAME_ID = "pdv0rk1w";

const mapIndexed = addIndex(map);

export async function getCommand(): Promise<Command> {
  const categories = await getGameCategories(WA_GAME_ID);

  const choices = reduce(
    (acc, category) => {
      const variable = category.variables?.[0];
      const subcategories = variable?.values;
      if (subcategories?.length > 0) {
        return [
          ...acc,
          ...map(
            (subcategory) => [
              `${category.name} - ${subcategory.label}`,
              `${category.id}?var-${variable.id}=${subcategory.id}`,
            ],
            subcategories
          ),
        ];
      } else {
        return [...acc, [category.name, category.id]];
      }
    },
    [],
    categories
  );

  console.log(choices);

  const commandBuilder = new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("See the leaderboard for a specific category.")
    .addStringOption((option) =>
      option
        .setName("category")
        .setDescription("The run category")
        .setRequired(true)
        .addChoices(choices)
    );

  return {
    data: commandBuilder.toJSON(),
    async execute(interaction: CommandInteraction) {
      const category = interaction.options.getString("category");

      const leaderboard = await getLeaderboard(WA_GAME_ID, category);

      interaction.reply({
        embeds: [leaderboardEmbed(leaderboard)],
      });
    },
  };
}

const top3Emoji = [
  "<:1st:886858947640852510>",
  "<:2nd:886858948408406016>",
  "<:3rd:886858948941066270>",
];

function leaderboardEmbed({
  category,
  subcategory,
  runs,
}: Leaderboard): MessageEmbed {
  const title = `W:A - ${category.name}${
    subcategory ? ` - ${subcategory.name}` : ""
  }`;

  return new MessageEmbed()
    .setTitle(title)
    .setColor("#79F14C")
    .addFields()
    .setDescription(
      runs.length > 0
        ? join(
            "\n",
            mapIndexed(
              (run: Run, i) =>
                `${
                  i < 3 ? top3Emoji[i] : "<:notTop3:886860513819115580>"
                } **${ordinal(i + 1)}**: [${run.player.name}](${
                  run.player.url ?? run.url
                }) in [${formatDuration(run.timeSeconds)}](${run.url})`,
              runs
            )
          )
        : "_No runs yet, go do one!_"
    );
}

function formatDuration(seconds: number): string {
  const h = (seconds - (seconds % 3600)) / 3600;
  const m = ((seconds - (seconds % 60)) / 60) % 60;
  const s = seconds % 60;
  return `${h > 0 ? `${h}h ` : ""}${m > 0 ? `${m}m ` : ""}${
    s > 0 ? `${s}s ` : ""
  }`;
}

function ordinal(i: number) {
  const j = i % 10;
  const k = i % 100;
  if (j == 1 && k != 11) {
    return i + "st";
  }
  if (j == 2 && k != 12) {
    return i + "nd";
  }
  if (j == 3 && k != 13) {
    return i + "rd";
  }
  return i + "th";
}
