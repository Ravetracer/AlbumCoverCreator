# Project Name: AlbumCoverCreator

## Short Description  
AlbumCoverCreator is a web app that allows users to create custom music album covers directly in the browser—completely backend-free and without any installation.

## Motivation  
Musicians and creatives often need simple, flexible tools to design attractive album covers. Many existing solutions are complex or require software downloads. AlbumCoverCreator offers an easy-to-use, instantly accessible solution that runs entirely in the browser.

## Target Audience  
This tool is aimed at musicians, bands, producers, and anyone who wants to design creative covers for their music projects—whether beginners or professionals.

## Key Features  
- Choose from pre-made background images (located in './covers') or upload your own  
- It has to be possible to add extensive image effects to the background image to alter it:
	- basic image correction functions: brightness, contrast, lights, shadows, highlights, whites, blacks, hue, saturation, vibrance, luminance, sharpness, clarity, dehaze, structure, vignette, cropping, resizing (smaller and larger)
	- blur
	- lots of color effects for different photo styles (black and white, sepia, duo-color and more)
	- glow
	- light flares for very bright parts like street lights
	- grain
	- distortions
	- pixelation (with different styles of the pixels like round dots, rectangles and much other forms with a lot of customization options)
	- color reduction to let the image look like retro computer images: ascii, commodore c64/amiga, atari st, old gaming consoles and more
		- should be highly configurable as well with a lot of different dithering algorithms; brightness, contrast and more to alter the image
	- cell shading
	- pop art
	- magazine style
- Upload and freely position logos and other images (textures for overlaying)
	- add options for rotating, resizing, mirroring and more 
- Add text with various fonts and extensive customization options
	- customizing of: position (drag'n'drop), color, size, rotation, curved, tilted with perspective
- Every item should go in their own layer: create a layer system with different layer modes; free layer ordering
- all items should be freely positionable by drag and drop them -> no X/Y sliders in the parameters!!
- all items should be freely resizable, especially the vector ones like text, geometric objects and SVGs; also add functionality for ratio keeping resizing
- add layers with additional, graphical effects to add more functions for visual improvements:
	- lens flares (take the idea from the folder './!dev/musicviz' with it's options but we don't need automations, only the types and positioning)
	- glowing particles: like dust particles but with slightly different sizes; they can have customizable colors and a glow around them with custom colors; set randomly in the entire image area
	- Add and edit all kinds of geometric shapes similar to a vector editor
	- Vector shapes can be outline or filled; can have different colors, gradients and different effects like glow, blur and more also in different colors
	- gradient lines with custom width, custom start and end width, custom corners (rectangle, round, whatever) -> add such options to all vector objects
- have different colors modes for all items which can be colored: static color, gradient, hue gradient and more
- Export the finished cover in high resolution, up to 4K, for download preferable in PNG but also in high quality JPG

## Vision  
AlbumCoverCreator aims to become a versatile, intuitive design tool that fosters creativity and makes the cover design process accessible to everyone—without technical barriers.

## Getting Started  
The web app will be usable directly in the browser with no installation or sign-up required. Just open the website, create your cover, and download it.

## Frameworks:
- use ReactJS for the frontend
- try to find best image manipulation library for JavaScript you can find for extensive image manipulation options and to reach the goal
- beware of supply chain attacks in the JavaScript ecosystem!!!
