const crypto = require('crypto');
const fs = require('fs');

if (process.argv.length < 4) {
  console.log("Usage: node decrypt.js <path_to_enc_file> <decryption_key_hex>");
  process.exit(1);
}

const filePath = process.argv[2];
const keyHex = process.argv[3].replace('0x', '');

try {
  const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(fileData.iv, 'hex');
  const ciphertext = Buffer.from(fileData.ciphertext, 'base64');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  
  // The GCM auth tag is the last 16 bytes of the ciphertext (WebCrypto standard)
  const tagLength = 16;
  const encryptedData = ciphertext.subarray(0, ciphertext.length - tagLength);
  const authTag = ciphertext.subarray(ciphertext.length - tagLength);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  console.log("--- SUCCESSFULLY DECRYPTED PAYLOAD ---");
  console.log(decrypted.toString('utf8'));
  console.log("--------------------------------------");
} catch (error) {
  console.error("Decryption failed! Did you use the correct key?", error.message);
}
