"""One-time sound design and original score; build uses committed WAV/MIDI files."""
import json,subprocess,os,math,wave,struct
os.makedirs('/tmp/wick-art',exist_ok=True)
os.makedirs('assets/audio',exist_ok=True)
def call(tool,cfg,*args):subprocess.run([tool,'--config',cfg,*map(str,args)],check=True,stdout=subprocess.DEVNULL)
base={'sample_rate':22050,'channels':'stereo','max_duration_ms':60000,'seed':176,'actions':'/tmp/wick-art/sound.json','preview':'/tmp/wick-art/sound.png','wav':'/tmp/wick-art/sound.wav'}
# Soft struck glass, dry brass, and low air: a coherent, restrained sound palette.
cues={'hit':(170,65,'triangle'),'kill':(510,100,'sine'),'gem':(1046,85,'sine'),'hurt':(105,360,'saw'),'level-up':(523,650,'sine'),'choose':(784,180,'triangle'),'chest':(262,600,'triangle'),'evolve':(392,1100,'sine'),'pickup':(659,180,'sine'),'fallen':(146,1600,'triangle'),'dawn':(523,2200,'sine'),'menu-move':(392,45,'sine'),'menu-confirm':(523,150,'triangle'),'hum':(110,4000,'sine')}
for name,(freq,dur,shape) in cues.items():
 cfg='/tmp/wick-art/sfx.json';base['wav']=os.path.abspath(f'assets/audio/{name}.wav');json.dump(base,open(cfg,'w'));call('sfx-synth',cfg,'init')
 call('sfx-synth',cfg,'add-voice','--name','body','--wave',shape,'--freq',freq,'--dur',dur,'--gain=-24' if name=='hum' else '--gain=-20')
 call('sfx-synth',cfg,'set-envelope','--voice','body','--env','gate' if name=='hum' else 'pluck')
 if name in ['hurt','fallen']:
  call('sfx-synth',cfg,'set-pitch','--voice','body','--slide-to',freq*.48,'--over',dur)
  call('sfx-synth',cfg,'add-voice','--name','air','--wave','noise','--dur',dur/2,'--gain=-34');call('sfx-synth',cfg,'set-envelope','--voice','air','--env','pluck')
 elif name not in ['hit','menu-move','hum']:
  for i,mul in enumerate([1.5,2]):
   call('sfx-synth',cfg,'add-voice','--name',f'glass{i}','--wave','sine','--freq',freq*mul,'--start',dur*.15*(i+1),'--dur',dur*.65,'--gain=-27');call('sfx-synth',cfg,'set-envelope','--voice',f'glass{i}','--env','pluck')
 call('sfx-synth',cfg,'render')
# Eight bars, A minor / F / C / E suspended. Delicate ostinato above a warm drone.
cfg='/tmp/wick-art/music.json';base.update({'wav':os.path.abspath('assets/audio/music.wav'),'mid':os.path.abspath('assets/audio/music.mid'),'actions':'/tmp/wick-art/score.json','max_duration_ms':40000,'instrument_bank':'cinematic'});json.dump(base,open(cfg,'w'));call('music',cfg,'init');call('music',cfg,'set-tempo','--bpm',60)
for track,shape,gain,env in [('glass','sine',-25,'pluck'),('warmth','triangle',-32,'swell'),('bass','sine',-30,'swell')]:
 call('music',cfg,'define-track','--name',track,'--instrument',shape);call('music',cfg,'set-track-fx','--track',track,f'--gain={gain}','--env',env)
for bar in range(8):
 chord=[[57,60,64],[53,57,60],[48,55,60],[52,59,62]][bar%4]
 for note in chord:call('music',cfg,'add-note','--track','warmth','--pitch',note,'--t',bar*4,'--dur',4,'--velocity',65)
 call('music',cfg,'add-note','--track','bass','--pitch',chord[0]-12,'--t',bar*4,'--dur',4,'--velocity',70)
 for i in range(8):call('music',cfg,'add-note','--track','glass','--pitch',chord[[0,2,1,2,0,1,2,1][i]]+12,'--t',bar*4+i*.5,'--dur',.48,'--velocity',45+(i%3)*9)
call('music',cfg,'render')
# Circular crossfade removes envelope seams without adding a silent pad.
for name,length in [('hum',4),('music',32)]:
 path=f'assets/audio/{name}.wav'
 with wave.open(path,'rb') as w:params=w.getparams();raw=w.readframes(w.getnframes())
 data=list(struct.unpack('<'+'h'*(len(raw)//2),raw));ch=params.nchannels;frames=int(length*params.framerate);data=(data+[0]*(frames*ch))[:frames*ch];fade=int(.025*params.framerate)
 for i in range(fade):
  t=i/fade
  for c in range(ch):
   start=data[i*ch+c];end=data[(frames-fade+i)*ch+c];mixed=int(end*(1-t)+start*t);data[i*ch+c]=mixed;data[(frames-fade+i)*ch+c]=mixed
 # Two endpoint samples share their average, keeping the seam exact.
 for c in range(ch):data[c]=data[(frames-1)*ch+c]=int((data[c]+data[(frames-1)*ch+c])/2)
 with wave.open(path,'wb') as w:w.setparams(params);w.writeframes(struct.pack('<'+'h'*len(data),*data))
print('Fourteen cues and a 32-second original score rendered.')
