import struct,sys
def boxes(d,s,e):
    p=s
    while p+8<=e:
        sz,t=struct.unpack('>I4s',d[p:p+8]);h=8
        if sz==1: sz=struct.unpack('>Q',d[p+8:p+16])[0];h=16
        elif sz==0: sz=e-p
        yield t,p,p+h,p+sz
        p+=sz
def find(d,s,e,path):
    for t,p,b,q in boxes(d,s,e):
        if t==path[0]:
            if len(path)==1: yield p,b,q
            else: yield from find(d,b,q,path[1:])
f=sys.argv[1]; d=open(f,'rb').read()
tops=[(t,p,q) for t,p,b,q in boxes(d,0,len(d))]
print('TOP:',[(t.decode(),p,q-p) for t,p,q in tops])
mdats=[(p,q) for t,p,q in tops if t==b'mdat']
moov=[(b,q) for t,p,b,q in boxes(d,0,len(d)) if t==b'moov'][0]
for i,(tp,tb,tq) in enumerate([(p,b,q) for t,p,b,q in boxes(d,*moov) if t==b'trak']):
    print(f'--- trak#{i}')
    tk=d[[b for t,p,b,q in boxes(d,tb,tq) if t==b'tkhd'][0]:][:84]
    v=tk[0]; fl=tk[1:4].hex()
    if v==0: cr,mo,tid,_,dur=struct.unpack('>IIIII',tk[4:24]); off=24
    else: cr,mo,tid,_,dur=struct.unpack('>QQIIQ',tk[4:36]); off=36
    w,h=struct.unpack('>II',tk[off+52:off+60])
    print(f' tkhd ver={v} flags={fl} id={tid} dur={dur} vol/layer/alt={tk[off+8:off+16].hex()} size={w>>16}x{h>>16}')
    for ep,eb,eq in find(d,tb,tq,[b'edts',b'elst']):
        n=struct.unpack('>I',d[eb+4:eb+8])[0]; v=d[eb]
        ents=[]
        for k in range(n):
            if v==0: ents.append(struct.unpack('>IiHH',d[eb+8+k*12:eb+20+k*12]))
            else: ents.append(struct.unpack('>QqHH',d[eb+8+k*20:eb+28+k*20]))
        print(' elst',ents)
    st=[(b,q) for p,b,q in find(d,tb,tq,[b'mdia',b'minf',b'stbl'])][0]
    for t,p,b,q in boxes(d,*st):
        body=d[b:q]
        if t==b'stts':
            n=struct.unpack('>I',body[4:8])[0]; print(' stts',[struct.unpack('>II',body[8+k*8:16+k*8]) for k in range(min(n,6))])
        if t==b'stsc':
            n=struct.unpack('>I',body[4:8])[0]; print(' stsc n=%d first3'%n,[struct.unpack('>III',body[8+k*12:20+k*12]) for k in range(min(n,3))],'last',struct.unpack('>III',body[8+(n-1)*12:20+(n-1)*12]))
        if t==b'stco':
            n=struct.unpack('>I',body[4:8])[0]; offs=struct.unpack('>%dI'%n,body[8:8+4*n])
            inm=[sum(1 for o in offs if a<=o<b2) for a,b2 in mdats]
            print(' stco n=%d first=%d last=%d per-mdat chunk counts=%s'%(n,offs[0],offs[-1],inm))
        if t==b'stsz':
            sz,n=struct.unpack('>II',body[4:12]); sizes=struct.unpack('>%dI'%n,body[12:12+4*n]); print(' stsz n=%d sum=%d min=%d max=%d'%(n,sum(sizes),min(sizes),max(sizes)))
        if t==b'stsd':
            print(' stsd len',len(body),'tail', body[-40:].hex() if body[12:16]==b'mp4a' else '')
