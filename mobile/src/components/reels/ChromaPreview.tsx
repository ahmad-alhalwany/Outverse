import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

export const BACKDROP_CSS: Record<string, string> = {
  nebula: 'radial-gradient(circle at 30% 20%, #a78bfa 0%, #4c1d95 45%, #0f0a1f 100%)',
  orbit: 'radial-gradient(circle at 70% 30%, #22d3ee 0%, #0e7490 40%, #082f49 100%)',
  void: 'linear-gradient(180deg, #111827 0%, #030712 100%)',
  aurora: 'linear-gradient(135deg, #34d399 0%, #059669 40%, #0f172a 100%)',
  sunset: 'linear-gradient(160deg, #fb923c 0%, #c2410c 45%, #1c1917 100%)',
};

type Props = {
  videoUri: string;
  backdrop: string;
  height?: number;
};

/**
 * Live chroma-key preview via WebView canvas (same green-key rule as web ReelGreenScreenStudio).
 * Keys pixels where g > 90 && g > r*1.35 && g > b*1.35, revealing the cosmic backdrop.
 */
export default function ChromaPreview({ videoUri, backdrop, height = 280 }: Props) {
  const bg = BACKDROP_CSS[backdrop] || BACKDROP_CSS.nebula;

  const html = useMemo(() => {
    const src = JSON.stringify(videoUri);
    const background = JSON.stringify(bg);
    return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
<style>
  html,body{margin:0;padding:0;background:#0A0A0F;overflow:hidden;height:100%;}
  .wrap{position:relative;width:100%;height:100%;background:${bg.includes('gradient') ? '' : bg};}
  .bg{position:absolute;inset:0;background:${bg};}
  video{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}
  canvas{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;}
  .label{position:absolute;left:10px;top:10px;color:#fff;font:700 11px/1.2 system-ui;background:rgba(0,0,0,.45);padding:6px 8px;border-radius:999px;}
</style>
</head><body>
<div class="wrap">
  <div class="bg"></div>
  <video id="v" src=${src} playsinline muted autoplay loop crossorigin="anonymous"></video>
  <canvas id="c"></canvas>
  <div class="label">Live chroma preview</div>
</div>
<script>
(function(){
  var video=document.getElementById('v');
  var canvas=document.getElementById('c');
  var ctx=canvas.getContext('2d',{willReadFrequently:true});
  var alive=true;
  function draw(){
    if(!alive) return;
    if(video.readyState>=2){
      var w=video.videoWidth||360, h=video.videoHeight||640;
      if(canvas.width!==w) canvas.width=w;
      if(canvas.height!==h) canvas.height=h;
      ctx.drawImage(video,0,0,w,h);
      try{
        var frame=ctx.getImageData(0,0,w,h);
        var data=frame.data;
        for(var i=0;i<data.length;i+=4){
          var r=data[i], g=data[i+1], b=data[i+2];
          if(g>90 && g>r*1.35 && g>b*1.35) data[i+3]=0;
        }
        ctx.putImageData(frame,0,0);
      }catch(e){}
    }
    requestAnimationFrame(draw);
  }
  video.play().catch(function(){});
  requestAnimationFrame(draw);
})();
</script>
</body></html>`;
  }, [videoUri, bg]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.fallback, { height, backgroundColor: '#111827' }]}>
        <Text style={styles.fallbackText}>Chroma preview runs on iOS/Android devices.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]} accessibilityLabel="Green screen chroma preview">
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        scrollEnabled={false}
        javaScriptEnabled
        allowFileAccess
        allowingReadAccessToURL={videoUri}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#0A0A0F',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  fallback: {
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  fallbackText: { color: '#A5B4FC', fontWeight: '600' },
});
