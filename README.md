# mediaproxy
 A proxy to read file metadata (EXIF, IPTC, ID3, AdobeXMP, EBML/matroska, mp4 etc.) and cache media and deliver ActivityPub markup.

## WIP - work in progress

It also has media manipulation support, e.g.

http://localhost:8080/w/200/rotate/90/png/80_lossless/https://cdn.prod.www...
for now for images,
chainable paths - chain up to 5 Resize/Image operations + 1 Output operation:
Resizing images;
-> {size} is the integer width/height in pixels or an explicit {width}x{height} string (evt. changes aspect ratio)
/w/{size} or /width/{size}
/h/{size} or /height/{size}
/cover/{size}
    aspect ratio maintained, ensure the image covers both provided dimensions by cropping/clipping to fit.
/contain/{size}
    aspect ratio maintained, contain within both provided dimensions using "letterboxing".
/fill/{size}
    Ignore the aspect ratio of the input and stretch to both provided dimensions.

---

Image operations;
/rotate/{angle}
    angle:number; will convert to a valid positive degree rotation. E.g., -450 will produce 270
/flip/
    Flip the image about the vertical Y axis. This always occurs after rotation, if any.
    The use of flip implies the removal of the EXIF Orientation tag, if any.
/flop/
    Flop the image about the horizontal X axis. This always occurs after rotation, if any.
    The use of flop implies the removal of the EXIF Orientation tag, if any.
/flatten/{background}/
    Merge alpha transparency channel, if any, with a background, then remove the alpha channel.
    background:string hex color without # or rgb-string (optional) e.g. '000000' or 'rgb(255, 255, 255)'
/linear/{a?}/{b?}
    // TODO see https://github.com/libvips/libvips/issues/1741#issuecomment-663400937
    Levels adjustment of the ends
    Apply the linear formula a * input + b to the image, see also gamma
    a:number  multiplier (optional, default 1.0)
    b:number  offset (optional, default 0.0)
/clahe/{width_height_maxSlope?}
    This will, in general, enhance the clarity of the image by bringing out darker details.
    a string; values separated by underscore:
    width:number  integer width of the region in pixels.
    height:number  integer height of the region in pixels.
    maxSlope:number  maximum value for the slope of the cumulative histogram:
    // A value of 0 disables contrast limiting. Range 0-100 (inclusive) (optional, default 3)
/modulate/{brightness?_saturation?_hue?_lightness?}
    Transforms the image using brightness, saturation, hue rotation, and lightness.
    a string; values separated by underscore:
    brightness:number Brightness multiplier (optional)
    saturation:number Saturation multiplier (optional)
    hue:number Degrees for hue rotation (optional)
    lightness:number Lightness addend (optional)
/sharpen/{sigma?_flat?_jagged?}/
    When used without parameters, performs a fast, mild sharpen of the output image.
    a string; values separated by underscore:
    sigma:number the sigma of the Gaussian mask, where sigma = 1 + radius / 2 (optional)
    flat:number  the level of sharpening to apply to "flat" areas. (optional, default 1.0)
    jagged::number  the level of sharpening to apply to "jagged" areas. (optional, default 2.0)
/blur/{sigma}/
    When a sigma is provided, performs a slower, more accurate Gaussian blur.
    sigma:number a value between 0.3 and 1000 representing the sigma of the Gaussian mask; sigma = 1+radius/2 (optional)
/median/{size}/
    Apply median filter. When used without parameters the default window is 3x3.
    size:number (optional, default 3)
/gamma/{gamma}/{gammaOut}/
    Apply a gamma correction by reducing the encoding (darken) pre-resize at a factor of 1/gamma then increasing the encoding
    (brighten) post-resize at a factor of gamma. This can improve the perceived brightness of a resized image in non-linear
    colour spaces. JPEG and WebP input images will not take advantage of the shrink-on-load performance optimisation.
    Supply a second argument to use a different output gamma value, otherwise the first value is used in both cases.
    gamma:number value between 1.0 and 3.0. (optional, default 2.2)
    gammaOut:number value between 1.0 and 3.0. (optional, default 2.2)
/negate/
/negate/noalpha
    Produce the "negative" of the image.
    noalpha: Do not negate any alpha channel
/tint/{color}
    color:string hex color without # or rgb-string (optional) e.g. '000000' or 'rgb(255, 255, 255)'
/desaturate/
    Convert to greyscale; shortcut for modulate/1_0
/grayscale/
/greyscale/
    Convert to 8-bit greyscale; 256 shades of grey.
/normalise/
/normalize/
    Enhance output image contrast by stretching its luminance to cover the full dynamic range.
/withMetadata/{orientation}/
    Include all metadata (EXIF, XMP, IPTC) from the input image in the output image.
    Will also convert to a web-friendly sRGB ICC profile unless a custom profile is provided.
    orientation:number value between 1 and 8, used to update the EXIF Orientation tag (optional)
---
in the end:
Output operations;
/jpg/{quality}/mozjpeg?_progressive?_optimiseScans?/
/jpeg/{quality}/mozjpeg?_progressive?_optimiseScans?/
/png/{quality}/progressive?/
/webp/{quality}/lossless?_nearLossless?_smartSubsample?_loop?/
/gif/{colors}/loop?/
/avif/{quality}/lossless?/
/heif/{quality}/lossless?/
/tif/{bitdepth}/
/tiff/{bitdepth}/
[
For output formats a string; values separated by underscore: quality:number and named flags
quality is 1 - 100 and colors is 2 - 256;   e.g. /png/80/ or /jpg/80/progressive/
The named flag 'loop' can be extended by {iterations}_{delay} (integers for count and milliseconds)
e.g. /gif/16/loop4_100
]
More depend on libvips compilation:
The router will log all supported formats when starting.
See also https://sharp.pixelplumbing.com
*/

/* TODO
make it a pluggable router
sharp.metadata();
sharp.composite();
sharp.cache();
sharp.concurrency();
-more output options-
png   colours
jp2   tileWidth, tileHeight (+ options.tile = true)
tiff  bitdepth?   tileWidth, tileHeight (+ options.tile = true)
