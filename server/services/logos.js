const fs = require('fs/promises')
const path = require('path')
const crypto = require('crypto')
const sharp = require('sharp')
const { fail } = require('./rosters')
const KEY = /^[a-f0-9]{32}\.webp$/
function storageRoot() {
  const configured = process.env.LOGO_STORAGE_DIR
  if (configured && !path.isAbsolute(configured)) throw fail(503,'Team logo storage must use an absolute persistent directory')
  if (process.env.NODE_ENV === 'production' && !configured) throw fail(503,'Team logo storage is not configured. Configure a persistent upload volume.')
  return configured || path.join(__dirname,'../data/team-logos')
}
async function normalizeLogo(file) {
  if (!file?.buffer?.length) throw fail(400,'Choose a PNG, JPEG, or WebP logo')
  if (file.buffer.length > 2 * 1024 * 1024) throw fail(413,'Team logos must be 2 MB or smaller')
  const bytes=file.buffer
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpeg=bytes.length>3 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255
  const webp=bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP'
  if(!png&&!jpeg&&!webp)throw fail(400,'Use a PNG, JPEG, or WebP logo; SVG and other file types are not supported')
  try {
    const image = sharp(file.buffer,{limitInputPixels:16777216,failOn:'warning'})
    const metadata = await image.metadata()
    const mime = { png:'image/png',jpeg:'image/jpeg',webp:'image/webp' }[metadata.format]
    if (!mime || mime !== file.mimetype || (metadata.pages || 1) !== 1 || !metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096) throw new Error('Unsupported image')
    // Decode and re-encode: no scripts, original filenames, EXIF or original bytes are served.
    return await image.rotate().resize(256,256,{fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer()
  } catch { throw fail(400,'Invalid logo. Use a non-animated PNG, JPEG, or WebP up to 4096 × 4096 pixels.') }
}
async function storeLogo(buffer) {
  const root = storageRoot()
  const key = `${crypto.randomBytes(16).toString('hex')}.webp`
  try {
    await fs.mkdir(root,{recursive:true,mode:0o700})
    await fs.writeFile(path.join(root,key),buffer,{flag:'wx',mode:0o600})
  } catch {
    await fs.unlink(path.join(root,key)).catch(()=>{})
    throw fail(503,'Team logo storage is unavailable. Check the persistent volume and its write permissions.')
  }
  return key
}
async function removeLogo(key) {
  if (!key || !KEY.test(key)) return
  try { await fs.unlink(path.join(storageRoot(),key)) } catch (error) { if (error.code !== 'ENOENT') console.error('Unable to clean up an unused team logo') }
}
module.exports = { normalizeLogo, storeLogo, removeLogo, storageRoot, KEY }
