import numpy as np, json, matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.colors import LightSource, ListedColormap
from matplotlib.path import Path
Z=np.load('z50.npy'); L=np.load('L50.npy'); step=50; half=64000
xs=np.arange(-half,half+1,step)
d=json.load(open('/workspace/agup-refs/field-layout.json'))
poly=np.array(d['concession']['vertices_east_north_m'])
c=len(xs)//2; k=400  # ±20km
z=Z[c-k:c+k+1,c-k:c+k+1]
X,Y=np.meshgrid(xs[c-k:c+k+1],xs[::-1][c-k:c+k+1])
inside=Path(poly).contains_points(np.c_[X.ravel(),Y.ravel()]).reshape(X.shape)
from scipy.ndimage import gaussian_filter
zs=gaussian_filter(Z,12)
print('CPF raw %.1f smoothed %.1f'%(Z[c,c],zs[c,c]))
zi=gaussian_filter(z,12)[inside]; print('concession smoothed: p5 %.1f p50 %.1f p95 %.1f'%tuple(np.percentile(zi,[5,50,95])))
spp=np.array(d['spp']['vertices_east_north_m'])
fig,ax=plt.subplots(1,2,figsize=(14,6.6),dpi=110)
ls=LightSource(azdeg=315,altdeg=35)
rgb=ls.shade(gaussian_filter(z,1.5),cmap=plt.cm.terrain,vert_exag=25,blend_mode='soft',vmin=-5,vmax=60,dx=50,dy=50)
ax[0].imshow(rgb,extent=[-20,20,-20,20])
cs=ax[0].contour(X/1000,Y/1000,gaussian_filter(z,8),levels=range(0,70,5),colors='k',linewidths=0.4,alpha=0.5); ax[0].clabel(cs,fontsize=6,fmt='%d m')
ax[0].plot(*np.vstack([poly,poly[:1]]).T/1000,'r-',lw=1.5,label='concession (traced)')
ax[0].plot(*np.vstack([spp,spp[:1]]).T/1000,'b--',lw=1,label='SPP')
ax[0].plot(0,0,'k^',ms=8,label='CPF-1 (approx)')
ax[0].set_title('Copernicus GLO-30 DSM, 40×40 km around CPF-1\nhillshade ×25 vertical, contours 5 m'); ax[0].set_xlabel('km east of CPF-1'); ax[0].set_ylabel('km north'); ax[0].legend(fontsize=7,loc='lower right')
# right: wide landcover
cmap={10:(0,0.4,0),20:(0.6,0.6,0.2),30:(0.8,0.8,0.4),40:(0.9,0.6,0.9),50:(0.8,0,0),60:(0.82,0.74,0.6),80:(0,0.35,0.8),90:(0.2,0.6,0.6),95:(0,0.8,0.5)}
Lr=L[::4,::4]; img=np.zeros(Lr.shape+(3,))
for kk,v in cmap.items(): img[Lr==kk]=v
sh=ls.hillshade(gaussian_filter(Z[::4,::4],1),vert_exag=25,dx=200,dy=200)
ax[1].imshow(img*(0.55+0.45*sh[...,None]),extent=[-64,64,-64,64])
cs=ax[1].contour(xs/1000,xs[::-1]/1000,zs,levels=[5,10,20,30,40,60,80,100,130],colors='k',linewidths=0.4); ax[1].clabel(cs,fontsize=6,fmt='%d m')
ax[1].plot(*np.vstack([poly,poly[:1]]).T/1000,'r-',lw=1.2); ax[1].plot(0,0,'k^',ms=6)
ax[1].set_title('ESA WorldCover 2021 + DSM contours, ±64 km\nsand=bare/sparse, blue=water, teal=wetland, pink=crop, red=built'); ax[1].set_xlabel('km east')
plt.tight_layout(); plt.savefig('/workspace/agup-refs/ratawi-dem.png')
