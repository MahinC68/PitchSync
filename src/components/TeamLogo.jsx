import { useEffect, useState } from 'react'
import { teamLogoUrl } from '../api'
import styles from './TeamLogo.module.css'
export default function TeamLogo({name='',logoKey,size='small'}){
  const [failed,setFailed]=useState(false)
  useEffect(()=>setFailed(false),[logoKey])
  const url=teamLogoUrl(logoKey)
  const letters=name.split(/\s+/).filter(Boolean).map(word=>word[0]).slice(0,2).join('').toUpperCase()||'FC'
  return <span className={`${styles.logo} ${size==='large'?styles.large:size==='compact'?styles.compact:''}`} aria-hidden="true">
    {url&&!failed?<img src={url} alt="" onError={()=>setFailed(true)} />:<span className={styles.placeholder}>{letters}</span>}
  </span>
}
