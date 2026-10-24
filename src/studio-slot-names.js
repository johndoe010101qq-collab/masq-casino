const kinds=['hood','suit','glove','laptop','usb','lock','key','radio','flag','scatter','wild','bomb'];
export const STUDIO_SLOT_NAMES=Object.freeze(Object.fromEntries(Object.entries({
 slots:['Синяя конфета','Зелёная конфета','Фиолетовая конфета','Сердце','Бананы','Слива','Яблоко','Арбуз','Виноград','Леденец Scatter','Звезда Wild','Множитель'],
 maskhouse:['Ротвейлер','Йоркширский терьер','Такса','Кость','Туз','Король','Дама','Десятка','Валет','Бонусная лапа','Будка Wild','Ошейник'],
 lecipher:['Перчатки','Цилиндр','Блокнот','Карта','Часы','Кошелёк','Эспрессо','Ключ','Монета','Досье Scatter','Енот Wild','Декодер'],
}).map(([game,names])=>[game,Object.freeze(Object.fromEntries(kinds.map((k,i)=>[k,names[i]])))])));
