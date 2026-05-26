[System.Reflection.Assembly]::LoadWithPartialName("System.Drawing") | Out-Null

$srcPath = "C:\Users\Scott\.gemini\antigravity\brain\788989ca-84b9-4e42-8dab-6547a339eb48\snoozle_clean_1779478230445.png"
$destPath = "c:\Users\Scott\Desktop\Shared CRNA Scripts\frontend\snoozle.png"

$bmp = New-Object System.Drawing.Bitmap($srcPath)
$width = $bmp.Width
$height = $bmp.Height

# We will loop through all pixels and make the magenta background transparent.
# Magenta is high Red and Blue, low Green. We use a threshold to handle anti-aliasing.
for ($y = 0; $y -lt $height; $y++) {
    for ($x = 0; $x -lt $width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        
        # Calculate how "magenta" the pixel is.
        # If R and B are high, and G is low, it's magenta.
        if ($c.R -gt 130 -and $c.B -gt 130 -and $c.G -lt 120) {
            # Set to transparent (Alpha = 0)
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0, 0, 0, 0))
        }
    }
}

# Save as PNG to support transparency
$bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

Write-Output "Chroma-key transparent icon generated at $destPath"
