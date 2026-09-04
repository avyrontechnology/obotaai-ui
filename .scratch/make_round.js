const sharp = require('sharp');
const fs = require('fs');

async function main() {
  const input = '../public/brand/otobaAI-Flow-—-Favicon.png';
  const output = '../public/brand/otobaAI-Flow-—-Favicon-Round.png';
  
  const metadata = await sharp(input).metadata();
  const width = metadata.width;
  const r = width / 2;
  
  const circleSvg = `<svg width="${width}" height="${width}"><circle cx="${r}" cy="${r}" r="${r}" /></svg>`;
  
  await sharp(input)
    .composite([{
      input: Buffer.from(circleSvg),
      blend: 'dest-in'
    }])
    .toFile(output);
    
  console.log('Saved round image to ' + output);
}

main().catch(console.error);
