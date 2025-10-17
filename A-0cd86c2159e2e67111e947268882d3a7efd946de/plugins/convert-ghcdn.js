const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { cmd } = require('../command');

// Configuration
const CDN_CONFIG = {
  BASE_URL: 'https://mrfrankk-cdn.hf.space',
  API_KEY: 'subzero',
  DEFAULT_PATH: 'ice/'
};

// Enhanced extension mapping
function getExtension(mimeType) {
  const extMap = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'application/pdf': '.pdf',
    'application/zip': '.zip',
    'application/x-zip-compressed': '.zip'
  };

  for (const [type, ext] of Object.entries(extMap)) {
    if (mimeType.includes(type)) return ext;
  }
  return '.dat';
}

// Helper functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function cleanTempFile(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Temp file cleanup failed:', err);
    }
  }
}

function formatResponse(fileName, size, url) {
  return `*📁 CDN Upload Successful*\n\n` +
         `🔖 *Filename:* ${fileName}\n` +
         `📊 *Size:* ${formatBytes(size)}\n` +
         `🔗 *URL:* ${url}\n\n` +
         `_Powered by Mr Frank CDN_`;
}

// Command handler
cmd({
    pattern: 'cdn',
    alias: ['upload', 'cdnup'],
    react: '⬆️',
    desc: 'Upload files to CDN with custom names',
    category: 'utility',
    use: '<.cdn filename> (reply to media)',
    filename: __filename
}, async (m, sock, { args, reply, quoted }) => {
    let tempFilePath;
    try {
        const media = quoted ? quoted : m;
        const mimeType = media.mimetype || '';
        
        if (!mimeType) {
            return await reply('❌ Please reply to a media file');
        }

        const mediaBuffer = await media.download();
        tempFilePath = path.join(os.tmpdir(), `cdn_temp_${Date.now()}`);
        fs.writeFileSync(tempFilePath, mediaBuffer);

        // Get the correct extension for the mime type
        const extension = getExtension(mimeType);
        
        // Process filename
        let fileName;
        if (args && args.trim().length > 0) {
            // Use custom name but ensure it has the correct extension
            const baseName = args.trim().replace(/[^\w.-]/g, '_');
            fileName = `${baseName}${extension}`;
        } else {
            // Fallback to timestamp if no name provided
            fileName = `file_${Date.now()}${extension}`;
        }

        const form = new FormData();
        form.append('file', fs.createReadStream(tempFilePath), fileName);
        form.append('path', CDN_CONFIG.DEFAULT_PATH);

        const response = await axios.post(
            `${CDN_CONFIG.BASE_URL}/upload`, 
            form, 
            {
                headers: {
                    ...form.getHeaders(),
                    'X-API-Key': CDN_CONFIG.API_KEY
                },
                timeout: 30000
            }
        );

        if (!response.data?.success) {
            throw new Error(response.data?.message || 'Upload failed');
        }

        await reply(formatResponse(
            fileName,
            mediaBuffer.length,
            response.data.cdnUrl || response.data.url
        ));

    } catch (error) {
        console.error('CDN Error:', error);
        await reply(`❌ Error: ${error.message}`);
    } finally {
        cleanTempFile(tempFilePath);
    }
});
