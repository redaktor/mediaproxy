const fs = require('fs');

async function getIt() {
  const { getMeta } = await import('./sources/ebml/index.js');
  fs.readFile('./data/movTags.webm', async (err, data) => {
    if (err) { throw err; }

    const meta = await getMeta(data);
    console.log(meta);
    return meta
  });
}
getIt()
