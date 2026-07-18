import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { v4 as uuid } from "uuid";

import {
    createJob,
    getJob,
    completeJob,
    failJob
} from "./progress.js";

import { generatePDF } from "./scraper.js";

const app = express();

const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "public")));

if (!fs.existsSync("./downloads")) {
    fs.mkdirSync("./downloads");
}

/*
|--------------------------------------------------------------------------
| Generate PDF
|--------------------------------------------------------------------------
*/

app.post("/api/generate", async (req, res) => {

    const { url } = req.body;

    if (!url) {
        return res.status(400).json({
            error: "URL is required"
        });
    }

    const jobId = uuid();

    createJob(jobId);

    // Run scraper in background
    generatePDF(jobId, url)
        .then((pdfPath) => {
            completeJob(jobId, pdfPath);
        })
        .catch((err) => {
            console.error(err);
            failJob(jobId, err.message);
        });

    res.json({
        jobId
    });

});


/*
|--------------------------------------------------------------------------
| Server Sent Events
|--------------------------------------------------------------------------
*/

app.get("/api/progress/:jobId", (req, res) => {

    const { jobId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const timer = setInterval(() => {

        const job = getJob(jobId);

        if (!job) {

            res.write(
                `data: ${JSON.stringify({
                    error: "Job not found"
                })}\n\n`
            );

            clearInterval(timer);

            return res.end();

        }

        res.write(
            `data: ${JSON.stringify(job)}\n\n`
        );

        if (job.completed) {

            clearInterval(timer);

            res.end();

        }

    }, 300);

});


/*
|--------------------------------------------------------------------------
| Download PDF
|--------------------------------------------------------------------------
*/

app.get("/api/download/:jobId", (req, res) => {

    const job = getJob(req.params.jobId);

    if (!job) {

        return res.status(404).send("Job not found");

    }

    if (!job.completed) {

        return res.status(400).send("PDF not ready");

    }

    if (job.error) {

        return res.status(500).send(job.error);

    }

    res.download(job.pdfPath);

});


app.listen(PORT, () => {

    console.log("");
    console.log("=================================");
    console.log(" PDF Generator Started");
    console.log("=================================");
    console.log("");
    console.log(`http://localhost:${PORT}`);
    console.log("");

});