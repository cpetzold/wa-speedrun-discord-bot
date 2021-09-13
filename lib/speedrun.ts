import { find, keys, map, toPairs } from "ramda";

import { URLSearchParams } from "url";
import got from "got";

// https://www.speedrun.com/api/v1/games/pdv0rk1w/categories

export const client = got.extend({
  prefixUrl: "https://www.speedrun.com/api/v1",
  responseType: "json",
});

export type CategoryVariableValue = {
  id: string;
  label: string;
  rules: string;
};

export type CategoryVariable = {
  id: string;
  name: string;
  defaultValue: string;
  values: CategoryVariableValue[];
};

export type Category = {
  id: string;
  name: string;
  url: string;
  rules: string;
  variables?: CategoryVariable[];
};

type CategoryVariableValueResponse = {
  label: string;
  rules: string;
};

type CategoryVariableResponse = {
  id: string;
  name: string;
  values: {
    default: string;
    values: { [valueId: string]: CategoryVariableValueResponse };
  };
};

type CategoryVariablesResponse = {
  data: CategoryVariableResponse[];
};

type CategoryResponse = {
  id: string;
  name: string;
  weblink: string;
  rules: string;
  variables: CategoryVariablesResponse;
};

type GameCategoriesResponse = {
  data: CategoryResponse[];
};

type LinkResponse = {
  uri: string;
};

type PlayerResponse = {
  rel: "user";
  id: string;
  names: {
    international: string;
    japanese: string;
  };
  weblink: string;
};

type GuestResponse = {
  rel: "guest";
  name: string;
};

type RunResponse = {
  id: string;
  weblink: string;
  videos: {
    links: LinkResponse[];
  };
  players: {
    rel: "user" | "guest";
    id?: string;
    name?: string;
  }[];
  comment: string;
  status: {
    status: string;
  };
  times: {
    primary_t: number;
  };
};

type LeaderboardResponse = {
  data: {
    category: { data: CategoryResponse };
    weblink: string;
    runs: {
      run: RunResponse;
    }[];
    players: {
      data: (PlayerResponse | GuestResponse)[];
    };
    variables: {
      data: CategoryVariableResponse[];
    };
    values: {
      [variableId: string]: string;
    };
  };
};

export type Player = {
  id: string;
  url?: string;
  name: string;
};

export type Run = {
  id: string;
  url: string;
  videoUrl: string;
  player: Player;
  timeSeconds: number;
  comment: string;
};

export type Subcategory = {
  id: string;
  name: string;
  rules: string;
};

export type Leaderboard = {
  url: string;
  category: Category;
  subcategory?: Subcategory;
  runs: Run[];
};

function formatPlayer({ names, weblink, ...rest }: PlayerResponse): Player {
  return {
    name: names.international,
    url: weblink,
    ...rest,
  };
}

function formatGuestAsPlayer({ name }: GuestResponse): Player {
  return {
    id: name,
    name,
  };
}

function formatRun(
  { videos, weblink, players, times, ...rest }: RunResponse,
  playersResponse: (PlayerResponse | GuestResponse)[]
): Run {
  const videoUrl = videos?.links?.[0].uri;

  const playerRef = players[0];

  const playerResponse = find(
    (p) =>
      p.rel === "user" ? p.id === playerRef?.id : p.name === playerRef.name,
    playersResponse
  );

  const player =
    playerResponse.rel === "user"
      ? formatPlayer(playerResponse)
      : formatGuestAsPlayer(playerResponse);

  return {
    player,
    url: weblink,
    videoUrl,
    timeSeconds: times.primary_t,
    ...rest,
  };
}

function formatCategoryVariable({
  values,
  ...rest
}: CategoryVariableResponse): CategoryVariable {
  return {
    values: map(([id, rest]) => ({ id, ...rest }), toPairs(values.values)),
    defaultValue: values.default,
    ...rest,
  };
}

function formatCategory({
  variables,
  weblink,
  ...rest
}: CategoryResponse): Category {
  return {
    variables: variables ? map(formatCategoryVariable, variables.data) : null,
    url: weblink,
    ...rest,
  };
}

export async function getGameCategories(gameId: string): Promise<Category[]> {
  const response = await client.get<GameCategoriesResponse>(
    `games/${gameId}/categories`,
    {
      searchParams: {
        embed: "variables",
      },
    }
  );

  return map(formatCategory, response.body.data);
}

export async function getLeaderboard(
  gameId: string,
  categoryUri: string
): Promise<Leaderboard> {
  const [categoryId, categoryParamString] = categoryUri.split("?");
  const searchParams = new URLSearchParams(categoryParamString);

  searchParams.set("embed", "category,players,variables");

  const response = await client.get<LeaderboardResponse>(
    `leaderboards/${gameId}/category/${categoryId}`,
    {
      searchParams,
    }
  );

  const { category, players, weblink, runs, variables, values } =
    response.body.data;

  // console.log(response.url);
  // console.log(response.body.data);

  const variableId = keys(values)[0];
  const variable = find(({ id }) => id === variableId, variables.data);
  const valueId = values[variableId];
  const subcategory = variable?.values?.values?.[valueId];

  return {
    category: formatCategory({ ...category.data, variables }),
    subcategory: subcategory
      ? { ...subcategory, id: valueId, name: subcategory.label }
      : null,
    url: weblink,
    runs: map(({ run }) => formatRun(run, players.data), runs),
  };
}
