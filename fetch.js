import * as cheerio from "cheerio";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";

async function scrapeWebsite(url) {
  try {
    // Fetch webpage
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Get page title
    let title = $(".entry-title").first().text().trim() || "notes";
    title = title.replace(/[<>:"/\\|?*]/g, "").trim();

    // Collect all image URLs from the gallery
    const imageUrls = [];

    $(".wp-block-uagb-image-gallery picture").each((_, picture) => {
      let srcset =
        $(picture).find("source").first().attr("srcset") ||
        $(picture).find("img").first().attr("srcset");

      if (srcset) {
        // Take the first image from srcset
        const imageUrl = srcset.split(",")[0].trim().split(" ")[0];
        imageUrls.push(imageUrl);
      } else {
        const src = $(picture).find("img").first().attr("src");
        if (src) imageUrls.push(src);
      }
    });

    if (imageUrls.length === 0) {
      console.log("No gallery images found.");
      return;
    }

    console.log(`Found ${imageUrls.length} images.`);

    // Create PDF
    const pdfDoc = await PDFDocument.create();

    // Download and add each image
    for (let i = 0; i < imageUrls.length; i++) {
      const imageUrl = imageUrls[i];

      try {
        console.log(`[${i + 1}/${imageUrls.length}] Downloading ${imageUrl}`);

        const imgResponse = await fetch(imageUrl);

        if (!imgResponse.ok) {
          console.log(`Skipping ${imageUrl}`);
          continue;
        }

        const imgBuffer = Buffer.from(await imgResponse.arrayBuffer());

        // Convert to PNG so pdf-lib can embed it
        const pngBuffer = await sharp(imgBuffer).png().toBuffer();

        const image = await pdfDoc.embedPng(pngBuffer);

        const { width, height } = image.scale(1);

        // Create page matching image dimensions
        const page = pdfDoc.addPage([width, height]);

        page.drawImage(image, {
          x: 0,
          y: 0,
          width,
          height,
        });

        console.log(`✓ Added image ${i + 1}`);
      } catch (err) {
        console.error(`Failed to process ${imageUrl}`);
        console.error(err.message);
      }
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const outputFile = `${title}.pdf`;

    await fs.writeFile(outputFile, pdfBytes);

    console.log(`\n✅ PDF saved successfully: ${outputFile}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Example
scrapeWebsite(
  "https://boardstudy.in/ncert-class-12-biology-chapter-13-organisms-populations-notes/"
);