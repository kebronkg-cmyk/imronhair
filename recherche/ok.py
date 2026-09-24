import numpy as np
def srgb2lin(c):
    c=c/255.0; return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)
def lin2srgb(c):
    c=np.clip(c,0,1); return np.where(c<=0.0031308,12.92*c,1.055*c**(1/2.4)-0.055)*255
M1=np.array([[0.4122214708,0.5363325363,0.0514459929],[0.2119034982,0.6806995451,0.1073969566],[0.0883024619,0.2817188376,0.6299787005]])
M2=np.array([[0.2104542553,0.7936177850,-0.0040720468],[1.9779984951,-2.4285922050,0.4505937099],[0.0259040371,0.7827717662,-0.8086757660]])
def rgb2oklab(rgb):
    l=srgb2lin(rgb.astype(float))@M1.T; l=np.cbrt(l); return l@M2.T
def oklab2rgb(lab):
    l=lab@np.linalg.inv(M2).T; l=l**3; return lin2srgb(l@np.linalg.inv(M1).T)
def lch(lab):
    L=lab[...,0];C=np.hypot(lab[...,1],lab[...,2]);H=np.degrees(np.arctan2(lab[...,2],lab[...,1]))%360;return L,C,H
