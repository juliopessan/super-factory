import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(92)
// No sandbox de CI usa o Chromium já instalado; fora dele, o Remotion baixa o dele.
if (process.env.REMOTION_CHROME) Config.setBrowserExecutable(process.env.REMOTION_CHROME)
