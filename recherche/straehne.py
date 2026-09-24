import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates
from PIL import Image
from ok import oklab2rgb
def lic(noise,vx,vy,schritte,sl=1.5):
    h,w=noise.shape; yy,xx=np.mgrid[0:h,0:w].astype(np.float32)
    acc=noise.copy(); n=1.0
    for sgn in (1,-1):
        x,y=xx.copy(),yy.copy()
        for k in range(schritte):
            dx=map_coordinates(vx,[y,x],order=1,mode='reflect'); dy=map_coordinates(vy,[y,x],order=1,mode='reflect')
            x=np.clip(x+sgn*sl*dx,0,w-1); y=np.clip(y+sgn*sl*dy,0,h-1)
            wg=np.cos(k/schritte*np.pi/2)
            acc+=wg*map_coordinates(noise,[y,x],order=1,mode='reflect'); n+=wg
    return acc/n
def straehnen(w,h,seed,welle=0.55,frei=1.0,neigung=0.0,schritte=48,
              L0=.93,Lspan=.035,C0=.03,Cspan=.02,H=196,glanz=.05,glanzfarbe=.05,glanzlage=.5,wolke=.25):
    r=np.random.default_rng(seed)
    yy,xx=np.mgrid[0:h,0:w].astype(np.float32); u=xx/w; v=yy/h
    s=max(w,h)
    t1=gaussian_filter(r.standard_normal((h//8+1,w//8+1)),s/8/7)
    t1=np.kron(t1,np.ones((8,8)))[:h,:w]; t1/=t1.std()
    th=neigung+welle*np.sin(2*np.pi*(u*0.75*w/s+v*0.35*h/s)+0.7)+0.35*frei*t1
    vx,vy=np.cos(th).astype(np.float32),np.sin(th).astype(np.float32)
    noise=r.standard_normal((h,w)).astype(np.float32)
    noise=gaussian_filter(noise,.7)
    band=gaussian_filter(r.standard_normal((h//4+1,w//4+1)),6); band=np.kron(band,np.ones((4,4)))[:h,:w]; band/=band.std()
    noise*=(0.6+0.4*np.tanh(band))   # Strähnen dichter und lichter
    z=lic(noise,vx,vy,schritte); z=(z-z.mean())/z.std()
    wo=gaussian_filter(r.standard_normal((h//8+1,w//8+1)),s/8/10); wo=np.kron(wo,np.ones((8,8)))[:h,:w]; wo/=wo.std()
    # Glanz: ein breites Licht, das der Welle folgt — wie Licht auf Haar
    kurve=glanzlage+0.12*np.sin(2*np.pi*(u*0.75*w/s)+0.7+np.pi/2)
    gl=np.exp(-((v-kurve)/0.13)**2)
    t=z*0.6+wo*wolke
    L=L0+Lspan*np.tanh(t/1.5)+glanz*gl*(0.7+0.3*np.tanh(z))
    C=np.clip(C0-Cspan*np.tanh(t/1.5)+glanzfarbe*gl,0,None)
    hh=np.radians(H)
    lab=np.stack([L,C*np.cos(hh),C*np.sin(hh)],-1).reshape(-1,3)
    return Image.fromarray(np.clip(oklab2rgb(lab),0,255).round().astype('uint8').reshape(h,w,3))
if __name__=='__main__':
    import sys
    straehnen(1200,750,21,L0=.90,Lspan=.05,C0=.05,Cspan=.025,glanz=.06,glanzfarbe=.06,glanzlage=.55).save('probe-str-quer.png')
    straehnen(600,600,5,welle=.35,L0=.955,Lspan=.018,C0=.018,Cspan=.01,glanz=0,glanzfarbe=0,wolke=.4).save('probe-str-wand.png')
    straehnen(600,600,8,welle=.45,L0=.86,Lspan=.04,C0=.075,Cspan=.02,H=194,glanz=.03,glanzfarbe=.02).save('probe-str-aqua.png')
    straehnen(600,600,13,welle=.45,L0=.30,Lspan=.05,C0=.055,Cspan=.015,H=206,glanz=.03,glanzfarbe=.02).save('probe-str-tief.png')
