import extractFrames from 'ffmpeg-extract-frames';
import fetch from 'node-fetch'
import fs from 'fs/promises'

// this library doesn't seem to support landscape mode. use jsPdf if you wish
import imgToPDF from 'image-to-pdf'

import pdfKitInit from 'pdfkit'

import eizeFS from 'fs'

const say = console.log
import fatut from '@ffmpeg-installer/ffmpeg'
const ffmpegPath = fatut.path;
import ffmpeg from 'fluent-ffmpeg'
ffmpeg.setFfmpegPath(ffmpegPath);
import getPixelsOLD from 'get-pixels';

import { promisify } from 'util';
const getPixels = promisify(getPixelsOLD)


function megaSay(thing) {
    say("#############################", "\n" + thing, "\n#############################")

}

// under 5 will be the same
async function distance(pathImg1, pathImg2) {
    const [pixels1, pixels2] = await Promise.all([
        getPixels(pathImg1), getPixels(pathImg2)
    ]);

    // if width1 != width2 or same with height
    if (pixels1.shape[0] != pixels2.shape[0] || pixels1.shape[1] != pixels2.shape[1]) {
        return Infinity;
    }

    let result = 0;

    for (let y = 350; y < pixels1.shape[1]; y += 2) {
        for (let x = 350; x < pixels1.shape[0]; x += 3) {
            const channel = (x + y) % 3;
            const r1 = pixels1.get(x, y, channel);
            const r2 = pixels2.get(x, y, channel);
            result += (r1 - r2) ** 2;
        }
    }
    let xToCheck = Math.floor((pixels1.shape[0] - 350) / 3)
    let yToCheck = Math.floor((pixels1.shape[1] - 350) / 2)
    let pixChecked = Math.min(xToCheck, yToCheck)
    return Math.round(result / pixChecked / 1000) / 100
}


function secondsToTime(e) {
    let h = Math.floor(e / 3600).toString().padStart(2, '0'),
        m = Math.floor(e % 3600 / 60).toString().padStart(2, '0'),
        s = Math.floor(e % 60).toString().padStart(2, '0');

    return h + ':' + m + ':' + s;
}

function getFilesizeInBytes(filename) {
    const stats = eizeFS.statSync(filename);
    const fileSizeInBytes = stats.size;
    return fileSizeInBytes;
}



async function picValue(path) {
    return Math.floor(getFilesizeInBytes(path) / 2000)
}

async function saveifWasnt(sec, outputPath, secCheck = 1000, moviePath, starTime = 0) {
    if (!saveifWasnt.problems) {
        saveifWasnt.problems = 0
    }
    if (saveifWasnt.problems > 1) {
        say("finished all frames!")
        return
    }

    if (!saveifWasnt.framesExtracted) {
        saveifWasnt.framesExtracted = 0
    }
    let timestemp = secondsToTime(sec)
    say(timestemp, "so far " + saveifWasnt.framesExtracted + " frames extracted.")
    if (sec == 0) {
        return
    }
    try {
        await fs.readdir(outputPath)

    }
    catch {
        fs.mkdir(outputPath)
    }
    await extractFrames({
        input: moviePath,
        output: `./${outputPath}\\${sec}.jpg`,
        offsets: [sec * secCheck + starTime]

    })

    if (!eizeFS.existsSync(`./${outputPath}\\${sec - 1}.jpg`)) {
        saveifWasnt.problems++
        return
    }

    if (await distance(`./${outputPath}\\${sec}.jpg`, `./${outputPath}\\${sec - 1}.jpg`) < 0.3) {
        await fs.unlink((`./${outputPath}\\${sec - 1}.jpg`))
    }
    else {
        say("found a new frame!")
        saveifWasnt.framesExtracted++

    }


}



async function renderPDF(videoMaxLengthMin = 50, secCheck = 1000, outputPath = "output", starTimevido = 0) {
    let estimatedFinishTime = 0
    let complition = 0
    let starTime = Date.now()
    let lengthSecs = (videoMaxLengthMin + 1) * 60
    let pieceName = eizeFS.readdirSync("input")[0].split(".mp4")[0]
    say("extracting sheet from " + pieceName)

    let inputPath = `./input/${pieceName}.mp4`
    for (let i = 1; i < lengthSecs; i++) {
        try {
            await saveifWasnt(i, outputPath, secCheck, inputPath, starTimevido)
            complition++
            let rate = Math.round(complition / lengthSecs * 10000) / 100
            if (rate % 5 == 0 || Math.random() < 0.05) {
                megaSay("we are at " + rate + "%")
            }
            if (Math.round(rate) == 10 && estimatedFinishTime == 0) {
                estimatedFinishTime = Date.now() + (Date.now() - starTime) * 9
            }
            if (estimatedFinishTime != 0 && Math.random() < 0.2) {
                megaSay("Time Left:" + secondsToTime((estimatedFinishTime - Date.now()) / 1000))
            }



        }
        catch {
            break
        }

    }
    // rad images from dir
    let allimages = eizeFS.readdirSync("output").map(x => x.split(".jpg")[0])
        .sort((a, b) => Number(a) - Number(b))
        .map(img => `output/${String(img)}.jpg`)
    // generate pdf
    const pdf = new pdfKitInit({ autoFirstPage: false })
    pdf.pipe(
        eizeFS.createWriteStream(`output/${pieceName}.pdf`)
    ).on('finish', function () {
        say("Done! PDF is in the output folder!")
    });
    allimages.forEach(imgPath => {
        const img = pdf.openImage(imgPath);
        pdf.addPage({ size: [img.width, img.height] });
        pdf.image(img, 0, 0);
    })
    pdf.end();
    return
}

renderPDF(3, 1000, "output")