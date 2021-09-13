import { ButtonInteraction, CommandInteraction } from "discord.js";

import { APIApplicationCommandOption } from "discord-api-types";

export type CommandFile = {
  getCommand(): Promise<Command>;
};

export type Command = {
  data: {
    name: string;
    description: string;
    options: APIApplicationCommandOption[];
  };
  execute(interaction: CommandInteraction): Promise<void>;
  executeButton?(interaction: ButtonInteraction): Promise<void>;
};
