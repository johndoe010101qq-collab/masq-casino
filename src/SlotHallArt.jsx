import React from 'react';
import './HallFinishing.css';
import './HallSlotCovers.css';

const art = {
  slots:'/hall-bonanza-cover-v12.webp',
  maskhouse:'/maskhouse-cover-v13.webp',
  lecipher:'/hall-lexof-cover-v12.webp'
};

// Titles are part of each original cover. The parent button supplies its name.
export default function SlotHallArt({game,variant='cover'}) {
  const picture=art[game];
  if(!picture)return null;
  return <div className={'hall-slot-cover hall-slot-cover-'+game+' hall-slot-cover-'+variant} aria-hidden="true">
    <img className="hall-slot-cover-illustration" src={picture} alt="" width="960" height="540"
      loading={variant==='promo'?'eager':'lazy'} decoding="async" draggable="false"/>
  </div>;
}
