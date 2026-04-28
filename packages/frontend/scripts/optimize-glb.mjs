#!/usr/bin/env node
/**
 * Optimize robot.glb:
 * 1. Strip unused animations (keep only 5)
 * 2. Embed external textures back into GLB
 * 3. Compress textures to WebP
 * 4. Compress geometry with Draco
 * 5. Resample animation keyframes
 */

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { 
  prune, 
  dedup, 
  textureCompress, 
  resample,
  draco,
  weld,
} from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const KEEP_ANIMATIONS = [
  'SK_Huggy_RobotNew.ao|A_Huggy_Idle',
  'SK_Huggy_RobotNew.ao|A_Huggy_Dance_Bedrock',
  'SK_Huggy_RobotNew.ao|A_Huggy_Walk',
  'SK_Huggy_RobotNew.ao|A_Huggy_Attack',
  'SK_Huggy_RobotNew.ao|A_Huggy_Roar',
];

const INPUT = 'public/robot.glb';
const OUTPUT = 'public/robot_optimized.glb';

async function main() {
  console.log('🔧 Loading GLB...');
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      'draco3d.decoder': await draco3d.createDecoderModule(),
      'draco3d.encoder': await draco3d.createEncoderModule(),
    });

  const document = await io.read(INPUT);
  const root = document.getRoot();

  // 1. Strip unused animations
  console.log('✂️  Stripping unused animations...');
  const allAnims = root.listAnimations();
  let stripped = 0;
  for (const anim of allAnims) {
    if (!KEEP_ANIMATIONS.includes(anim.getName())) {
      anim.dispose();
      stripped++;
    }
  }
  console.log(`   Removed ${stripped} animations, kept ${KEEP_ANIMATIONS.length}`);

  // 2. Resample keyframes for smaller animation data
  console.log('📐 Resampling animations...');
  await document.transform(resample());

  // 3. Weld vertices (merge nearby vertices)
  console.log('🔗 Welding vertices...');
  await document.transform(weld());

  // 4. Deduplicate accessors/textures
  console.log('🔍 Deduplicating...');
  await document.transform(dedup());

  // 5. Prune unused resources
  console.log('🗑️  Pruning unused resources...');
  await document.transform(prune());

  // 6. Compress textures to WebP
  console.log('🖼️  Compressing textures to WebP...');
  await document.transform(
    textureCompress({
      encoder: sharp,
      targetFormat: 'webp',
      quality: 75,
    })
  );

  // 7. Compress geometry with Draco
  console.log('📦 Applying Draco compression...');
  await document.transform(draco());

  // Write output
  console.log('💾 Writing optimized GLB...');
  await io.write(OUTPUT, document);

  console.log('✅ Done! Output:', OUTPUT);
}

main().catch(console.error);
