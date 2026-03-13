const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const JSZip = require('jszip');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/download-site', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).send("URL is required");

    try {
        const zip = new JSZip();
        const rootUrl = new URL(url);
        
        // 1. Get main HTML
        const response = await axios.get(url);
        const $ = cheerio.load(response.data);
        
        // 2. Simple Asset Scraper (Images)
        const imgPromises = [];
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            if (src && !src.startsWith('data:')) {
                const imgUrl = new URL(src, url).href;
                const name = imgUrl.split('/').pop() || `img_${i}.png`;
                
                // Add to zip and update HTML
                const promise = axios.get(imgUrl, { responseType: 'arraybuffer' })
                    .then(r => zip.file(`images/${name}`, r.data))
                    .catch(() => {}); // Skip failed images
                imgPromises.push(promise);
                $(el).attr('src', `images/${name}`);
            }
        });

        await Promise.all(imgPromises);
        zip.file("index.html", $.html());

        // 3. Send the ZIP
        const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="site_backup.zip"`);
        res.send(zipBuffer);

    } catch (error) {
        res.status(500).send("Error scraping site: " + error.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));
