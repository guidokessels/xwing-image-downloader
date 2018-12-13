const fetch = require("node-fetch");
const download = require("image-downloader");
const chalk = require("chalk");
const log = console.log;

const CARDS_API = `https://squadbuilder.fantasyflightgames.com/api/cards/`;
const FFG_ID_MAP = `https://raw.githubusercontent.com/guidokessels/xwing-data2/master/data/ffg-xws.json`;
const IMAGES_FOLDER = `${__dirname}/images`;
const CHUNK_SIZE = 10;

const fetchJSON = async url => {
  log(`Fetching JSON from ${url}`);
  const response = await fetch(url);
  return await response.json();
};

const downloadImage = async (url, dest) => {
  log(`💾  ${chalk.blue(url)} ➡ ${chalk.green(dest)}`);
  return await download.image({ url, dest });
};

const str2filename = str =>
  str
    .toLowerCase()
    .replace(/ /g, "-")
    .replace(/\//g, "-")
    .replace(/\<[\/a-zA-Z]+\>/g, "")
    .replace(/[^a-z0-9-]/g, "");

const getChunks = arr => arr.splice(0, CHUNK_SIZE);

const processCards = async (chunks, results, remaining, ffgXwsMap, missing) => {
  const curr = await Promise.all(
    chunks
      .filter(card => card.card_image)
      .reduce((acc, card) => {
        let xws = undefined;
        const path = [IMAGES_FOLDER];

        if (card.card_type_id === 1) {
          xws = ffgXwsMap.pilots[card.id];
          path.push("pilots");
        } else if (card.card_type_id === 2) {
          xws = ffgXwsMap.upgrades[card.id];
          path.push("upgrades");
        }

        if (!xws) {
          missing.push(card.id);
          return acc;
        }

        const filename = `${xws}.png`;
        path.push(filename);
        acc.push(downloadImage(card.card_image, path.join("/")));
        return acc;
      }, [])
  );
  results.push(curr);

  return curr !== undefined && remaining.length
    ? processCards(getChunks(remaining), results, remaining, ffgXwsMap, missing)
    : results;
};

async function start() {
  const { cards = [] } = await fetchJSON(CARDS_API);
  const ffgXwsMap = await fetchJSON(FFG_ID_MAP);
  const downloads = [];
  const missing = [];

  await processCards(getChunks(cards), downloads, cards, ffgXwsMap, missing);

  await Promise.all(downloads);
  const flattenedDownloads = [].concat(...downloads);
  log(`Done! Downloaded ${chalk.blue(flattenedDownloads.length)} images`);

  if (missing.length) {
    log(`No XWS found for cards with the following ids:`);
    log(chalk.bold(missing.join(", ")));
  }
}

start();
