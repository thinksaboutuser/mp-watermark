const Telegraf = require('telegraf').Telegraf;
const express = require('express');
const expressApp = express();
const axios = require('axios');
const fs = require('fs');
const ffmpeg = require('ffmpeg');
const sharp = require('sharp');

require('dotenv').config()

const API_TOKEN = process.env.API_TOKEN || '';
const PORT = process.env.PORT || 3000;
const URL = process.env.URL || 'https://mp-watermark.herokuapp.com/';

const bot = new Telegraf(API_TOKEN);
bot.telegram.setWebhook(`${URL}/bot${API_TOKEN}`);
expressApp.use(bot.webhookCallback(`/bot${API_TOKEN}`));





bot.start((ctx) => ctx.reply('Welcome'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))



// todo
/*bot.command('watermark', async(ctx) => {
  ctx.reply("Please send a new watermark image");
});*/



bot.on('video', async (ctx) => {
  console.log('ctx:', ctx)
  console.log('video:', ctx.update.message.video)

  const {file_id: fileId, width: videoWidth, height: videoHeight} = ctx.update.message.video;
  //console.log('fileId', fileId)
  console.log('videoWidth', videoWidth)
  console.log('videoHeight', videoHeight)

  // todo: made watermark size based on ration and known formats
  let watermarSize = parseInt( videoWidth / 3.5 );
  if ( videoHeight > videoWidth ) {
    watermarSize = parseInt( videoHeight / 3.5 );
  }
  console.log('watermarSize', watermarSize)



  // Create watermark image in needed size
  let inputImgFile  = "./watermarks/watermark.png";
  let outputImgFile = `./watermarks/watermark-${watermarSize}.png`;

  sharp(inputImgFile).resize({ height: watermarSize }).toFile(outputImgFile)
    .then(function(newFileInfo) {
        // newFileInfo holds the output file properties
        //console.log("Success")

        // Add watermark
        ctx.telegram.getFileLink(fileId).then(async (url) => {
          axios({url: url.href, responseType: 'stream'}).then(response => {
            return new Promise((resolve, reject) => {
              //const filePath = `./videos/${ctx.update.message.from.id}.mp4`;
              const filePath = `./videos/${ctx.update.message.video.file_unique_id}.mp4`;

              response.data.pipe(fs.createWriteStream(filePath))
                .on('finish', () => {
                  //ctx.reply('finish')

                  try {
                    var process = new ffmpeg(filePath);
                    process.then(function (video) {
                      console.log('The video is ready to be processed');
                      //var watermarkPath = './watermarks/watermark.png',
                      let watermarkPath = outputImgFile,
                        newFilepath = `./videos/${ctx.update.message.video.file_unique_id}-with-watermark.mp4`,
                        settings = {
                            position        : "SE"      // Position: NE NC NW SE SC SW C CE CW
                          , margin_nord     : null      // Margin nord
                          , margin_sud      : null      // Margin sud
                          , margin_east     : null      // Margin east
                          , margin_west     : null      // Margin west
                        };
                      var callback = async function (error, files) {
                        if(error){
                          console.log('ERROR: ', error);
                          ctx.reply('error')
                        }
                        else{
                          console.log('TERMINOU', files);

                          /*ctx.telegram.sendDocument(ctx.from.id, {
                            source: data,
                            filename: 'somefilename.txt'
                          }).catch(function(error){ console.log(error); })*/

                          await ctx.replyWithVideo(`${URL}/${ctx.update.message.video.file_unique_id}-with-watermark.mp4`)
                          .then(()=>{
                            console.log('finish')

                            fs.unlinkSync(filePath);
                            fs.unlinkSync(newFilepath);
                            fs.unlinkSync(outputImgFile);
                          })
                          .catch(function(error){ console.log(error); })
                          //ctx.reply('finish')
                        }
                      }
                      //add watermark
                      video.fnAddWatermark(watermarkPath, newFilepath, settings, callback)

                    }, function (err) {
                      console.log('Error: ' + err);
                    });
                  } catch (e) {
                    console.log(e.code);
                    console.log(e.msg);
                  }

                })
                .on('error', e => {
                  console.log('error', e)
                  ctx.reply('error')
                })
              });
            })
        })


    })
    .catch(function(err) {
        console.log("Error occured. Watermark needed size not created");
    });



  //ctx.reply('test')
  //ctx.replyWithVideo( response.data )
})






bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))


// and at the end just start server on PORT
expressApp.get('/', (req, res) => {
  res.send('Hello World!');
});
expressApp.use(express.static('videos'))
expressApp.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
