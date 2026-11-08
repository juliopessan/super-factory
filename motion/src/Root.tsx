import { Composition } from 'remotion'

import { Hero } from './Hero'

export function Root() {
  return <Composition id="Hero" component={Hero} durationInFrames={450} fps={30} width={1920} height={1080} />
}
