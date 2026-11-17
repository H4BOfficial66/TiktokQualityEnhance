import struct,sys
CONT={b'moov',b'trak',b'mdia',b'minf',b'stbl',b'udta',b'edts',b'dinf'}
def walk(d,s,e,depth,out):
    p=s
    while p+8<=e:
        sz,t=struct.unpack('>I4s',d[p:p+8]);h=8
        if sz==1: sz=struct.unpack('>Q',d[p+8:p+16])[0];h=16
        elif sz==0: sz=e-p
        if sz<8 or p+sz>e: out.append('  '*depth+f'!! bad box {t} sz={sz}');break
        extra=''
        body=d[p+h:p+sz]
        if t==b'mvhd':
            v=body[0]
            if v==1: ts,du=struct.unpack('>IQ',body[20:32]);
            else: ts,du=struct.unpack('>II',body[12:20])
            extra=f' ver={v} timescale={ts} duration={du}'
        if t==b'mdhd':
            v=body[0]
            if v==1: ts,du=struct.unpack('>IQ',body[20:32])
            else: ts,du=struct.unpack('>II',body[12:20])
            extra=f' timescale={ts} duration={du}'
        if t==b'tkhd':
            v=body[0]; tid=struct.unpack('>I',body[(20 if v==1 else 12):(24 if v==1 else 16)])[0]
            extra=f' track_id={tid}'
        if t==b'hdlr': extra=' type='+body[8:12].decode('latin1')
        if t in(b'stts',b'stsc',b'stss',b'stco',b'co64',b'ctts'):
            extra=f' entries={struct.unpack(">I",body[4:8])[0]}'
        if t==b'stsz':
            extra=f' sample_size={struct.unpack(">I",body[4:8])[0]} count={struct.unpack(">I",body[8:12])[0]}'
        if t==b'stsd':
            extra=' fmt='+body[12:16].decode('latin1')
        out.append('  '*depth+f'{t.decode("latin1")} size={sz}{extra}')
        if t in CONT: walk(d,p+h,p+sz,depth+1,out)
        elif t==b'meta': walk(d,p+h+4,p+sz,depth+1,out)
        p+=sz
d=open(sys.argv[1],'rb').read();o=[];walk(d,0,len(d),0,o);print('\n'.join(o))
