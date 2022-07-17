# mediaproxy
 A proxy to read file metadata (EXIF, IPTC, ID3, AdobeXMP, EBML/matroska, mp4 etc.) and cache media and deliver ActivityPub markup.

## WIP - work in progress

It also has media manipulation support, e.g.<br>
<br>
`http://localhost:8080/w/200/rotate/90/png/80_lossless/https://cdn.prod.www...`<br>
– for now for images<br><br>
Chainable paths - chain up to 5 Resize/Image operations + 1 Output operation:<br>
Resizing images;<br><br>
-> {size} is the integer width/height in pixels or an explicit {width}x{height} string (evt. changes aspect ratio)<br>
`/w/{size} or /width/{size}`<br>
`/h/{size} or /height/{size}`<br>
`/cover/{size}`<br>
    aspect ratio maintained, ensure the image covers both provided dimensions by cropping/clipping to fit.<br>
`/contain/{size}`<br>
    aspect ratio maintained, contain within both provided dimensions using "letterboxing".<br>
`/fill/{size}`<br>
    Ignore the aspect ratio of the input and stretch to both provided dimensions.<br>
<br><br>

---

Image operations;<br><br>
`/rotate/{angle}`<br>
    angle:number; will convert to a valid positive degree rotation. E.g., -450 will produce 270<br><br>
`/flip/`<br>
    Flip the image about the vertical Y axis. This always occurs after rotation, if any.<br>
    The use of flip implies the removal of the EXIF Orientation tag, if any.<br><br>
`/flop/`<br>
    Flop the image about the horizontal X axis. This always occurs after rotation, if any.<br>
    The use of flop implies the removal of the EXIF Orientation tag, if any.<br><br>
`/flatten/{background}/`<br>
    Merge alpha transparency channel, if any, with a background, then remove the alpha channel.<br>
    background:string hex color without # or rgb-string (optional) e.g. '000000' or 'rgb(255, 255, 255)'<br><br>
`/linear/{a?}/{b?}`<br>
    // TODO see https://github.com/libvips/libvips/issues/1741#issuecomment-663400937<br>
    Levels adjustment of the ends<br>
    Apply the linear formula a * input + b to the image, see also gamma<br>
    a:number  multiplier (optional, default 1.0)<br>
    b:number  offset (optional, default 0.0)<br><br>
`/clahe/{width_height_maxSlope?}`<br>
    This will, in general, enhance the clarity of the image by bringing out darker details.<br>
    a string; values separated by underscore:<br>
    width:number  integer width of the region in pixels.<br>
    height:number  integer height of the region in pixels.<br>
    maxSlope:number  maximum value for the slope of the cumulative histogram:<br>
    // A value of 0 disables contrast limiting. Range 0-100 (inclusive) (optional, default 3)<br><br>
`/modulate/{brightness?_saturation?_hue?_lightness?}`<br>
    Transforms the image using brightness, saturation, hue rotation, and lightness.<br>
    a string; values separated by underscore:<br>
    brightness:number Brightness multiplier (optional)<br>
    saturation:number Saturation multiplier (optional)<br>
    hue:number Degrees for hue rotation (optional)<br>
    lightness:number Lightness addend (optional)<br><br>
`/sharpen/{sigma?_flat?_jagged?}/`<br>
    When used without parameters, performs a fast, mild sharpen of the output image.<br>
    a string; values separated by underscore:<br>
    sigma:number the sigma of the Gaussian mask, where sigma = 1 + radius / 2 (optional)<br>
    flat:number  the level of sharpening to apply to "flat" areas. (optional, default 1.0)<br>
    jagged::number  the level of sharpening to apply to "jagged" areas. (optional, default 2.0)<br><br>
`/blur/{sigma}/`<br>
    When a sigma is provided, performs a slower, more accurate Gaussian blur.<br>
    sigma:number a value between 0.3 and 1000 representing the sigma of the Gaussian mask; sigma = 1+radius/2 (optional)<br><br>
`/median/{size}/`<br>
    Apply median filter. When used without parameters the default window is 3x3.<br>
    size:number (optional, default 3)<br><br>
`/gamma/{gamma}/{gammaOut}/`<br>
    Apply a gamma correction by reducing the encoding (darken) pre-resize at a factor of 1/gamma then increasing the encoding
    (brighten) post-resize at a factor of gamma. This can improve the perceived brightness of a resized image in non-linear
    colour spaces. JPEG and WebP input images will not take advantage of the shrink-on-load performance optimisation.<br>
    Supply a second argument to use a different output gamma value, otherwise the first value is used in both cases.<br>
    gamma:number value between 1.0 and 3.0. (optional, default 2.2)<br>
    gammaOut:number value between 1.0 and 3.0. (optional, default 2.2)<br><br>
`/negate/`<br>
`/negate/noalpha`<br>
    Produce the "negative" of the image.<br>
    noalpha: Do not negate any alpha channel<br><br>
`/tint/{color}`<br>
    color:string hex color without # or rgb-string (optional) e.g. '000000' or 'rgb(255, 255, 255)'<br><br>
`/desaturate/`<br>
    Convert to greyscale; shortcut for modulate/1_0<br>
`/grayscale/`<br>
`/greyscale/`<br>
    Convert to 8-bit greyscale; 256 shades of grey.<br><br>
`/normalise/`<br>
`/normalize/`<br>
    Enhance output image contrast by stretching its luminance to cover the full dynamic range.<br><br>
**and**<br>
`/withMetadata/{orientation}/`<br>
    Include all metadata (EXIF, XMP, IPTC) from the input image in the output image as JSON-LD AP Object.<br>
    Will also convert to a web-friendly sRGB ICC profile unless a custom profile is provided.<br>
    orientation:number value between 1 and 8, used to update the EXIF Orientation tag (optional)<br><br>
    
---

<br>
In the end:<br>
Output operations;<br>
`/jpg/{quality}/mozjpeg?_progressive?_optimiseScans?/`<br>
`/jpeg/{quality}/mozjpeg?_progressive?_optimiseScans?/`<br>
`/png/{quality}/progressive?/`<br>
`/webp/{quality}/lossless?_nearLossless?_smartSubsample?_loop?/`<br>
`/gif/{colors}/loop?/`<br>
`/avif/{quality}/lossless?/`<br>
`/heif/{quality}/lossless?/`<br>
`/tif/{bitdepth}/`<br>
`/tiff/{bitdepth}/`<br><br>
[<br>
For output formats a string; values separated by underscore: quality:number and named flags<br>
quality is 1 - 100 and colors is 2 - 256;   e.g. /png/80/ or /jpg/80/progressive/<br>
The named flag 'loop' can be extended by {iterations}_{delay} (integers for count and milliseconds)<br>
e.g. /gif/16/loop4_100<br>
]<br><br>
More depend on libvips compilation:<br>
The router will log all supported formats when starting.<br>
See also https://sharp.pixelplumbing.com<br><br>

TODO<br>
make it a pluggable router<br>
sharp.metadata();<br>
sharp.composite();<br>
sharp.cache();<br>
sharp.concurrency();<br><br>
-more output options-<br>
png   colours<br>
jp2   tileWidth, tileHeight (+ options.tile = true)<br>
tiff  bitdepth?   tileWidth, tileHeight (+ options.tile = true)<br>
