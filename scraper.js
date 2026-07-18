import * as cheerio from "cheerio";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

import { updateJob } from "./progress.js";

const DOWNLOAD_DIR = "./downloads";

async function fetchBuffer(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to download image: ${url}`);
    }

    return Buffer.from(await response.arrayBuffer());
}

async function imageToJPEG(buffer) {

    return await sharp(buffer)
        .jpeg({
            quality: 85,
            mozjpeg: true
        })
        .toBuffer();

}

async function downloadImage(url) {

    const buffer = await fetchBuffer(url);

    return await imageToJPEG(buffer);

}

async function extractImages($) {

    const imageUrls = [];

    $(".wp-block-uagb-image-gallery picture").each((_, picture) => {

        let srcset =
            $(picture).find("source").first().attr("srcset") ||
            $(picture).find("img").first().attr("srcset");

        if (srcset) {

            imageUrls.push(
                srcset
                    .split(",")[0]
                    .trim()
                    .split(" ")[0]
            );

        } else {

            const src =
                $(picture).find("img").first().attr("src");

            if (src) imageUrls.push(src);

        }

    });

    return imageUrls;

}

export async function generatePDF(jobId, url) {

    updateJob(jobId, {
        status: "Fetching webpage..."
    });

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error("Unable to fetch webpage.");
    }

    const html = await response.text();

    const $ = cheerio.load(html);

    let title =
        $(".entry-title").first().text().trim() ||
        "notes";

    title = title.replace(/[<>:"/\\|?*]/g, "");

    const imageUrls = await extractImages($);

    if (imageUrls.length === 0) {
        throw new Error("No images found.");
    }

    updateJob(jobId, {
        status: "Found images",
        current: 0,
        total: imageUrls.length
    });

    const pdf = await PDFDocument.create();

    const downloadedImages = [];

    updateJob(jobId, {
        status: "Downloading images..."
    });

    const CONCURRENCY = 5;
    let completed = 0;

    async function processImage(imageUrl) {

        try {

            const pngBuffer = await downloadImage(imageUrl);

            downloadedImages.push(pngBuffer);

        } catch (err) {

            console.error("Failed:", imageUrl);

        }

        completed++;

        updateJob(jobId, {
            status: "Downloading images...",
            current: completed,
            total: imageUrls.length
        });

    }

    // Download images in batches
    for (let i = 0; i < imageUrls.length; i += CONCURRENCY) {

        const batch = imageUrls.slice(i, i + CONCURRENCY);

        await Promise.all(
            batch.map(processImage)
        );

    }

    if (downloadedImages.length === 0) {

        throw new Error("Unable to download any images.");

    }

    updateJob(jobId, {
        status: "Creating PDF...",
        current: downloadedImages.length,
        total: downloadedImages.length
    });

    updateJob(jobId, {
        status: "Building PDF...",
        current: 0,
        total: downloadedImages.length
    });

    let processed = 0;

    for (const pngBuffer of downloadedImages) {

        try {

            const image = await pdf.embedJpg(pngBuffer);

            const width = image.width;
            const height = image.height;

            const page = pdf.addPage([width, height]);

            page.drawImage(image, {
                x: 0,
                y: 0,
                width,
                height
            });

        } catch (err) {

            console.error("Failed to embed image:", err.message);

        }

        processed++;

        updateJob(jobId, {
            status: "Building PDF...",
            current: processed,
            total: downloadedImages.length
        });

    }

    updateJob(jobId, {
        status: "Saving PDF..."
    });

    const pdfBytes = await pdf.save({
        useObjectStreams: true
    });

    // Ensure downloads directory exists
    await fs.mkdir(DOWNLOAD_DIR, {
        recursive: true
    });

    // Create safe filename
    const safeTitle = title
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, "_")
        .substring(0, 80);

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    const fileName = `${safeTitle}_${timestamp}.pdf`;

    const outputPath = path.join(
        DOWNLOAD_DIR,
        fileName
    );

    updateJob(jobId, {
        status: "Completed",
        current: downloadedImages.length,
        total: downloadedImages.length,
        percentage: 100
    });

    return outputPath;

}