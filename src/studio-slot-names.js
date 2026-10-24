const kinds=['hood','suit','glove','laptop','usb','lock','key','radio','flag','scatter','wild','bomb'];
export const STUDIO_SLOT_NAMES=Object.freeze(Object.fromEntries(Object.entries({
 slots:['Сердце','Синяя конфета','Зелёная конфета','Фиолетовая конфета','Арбуз','Виноград','Слива','Яблоко','Бананы','Леденец Scatter','Звезда Wild','Множитель'],
 maskhouse:['Ротвейлер','Йоркширский терьер','Такса','Кость','Туз','Король','Дама','Десятка','Валет','Бонусная лапа','Будка Wild','Ошейник'],
 lecipher:['Капкан','Сыр','Пиво','Багет','Цилиндр','Туз','Король','Дама','Валет','Фотоаппарат FS','Wild','Радуга'],
}).map(([game,names])=>[game,Object.freeze(Object.fromEntries(kinds.map((k,i)=>[k,names[i]])))])));
