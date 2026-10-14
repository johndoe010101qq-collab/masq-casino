export const GAME_META = Object.freeze([
  { id:'coinflip', name:'Coinflip', description:'Маска или число', caption:'Выберите сторону монеты перед броском.', tag:'×2', duration:4.2, choice:'heads' },
  { id:'dice', name:'Dice', description:'Угадайте грань кубика', caption:'Выберите число от 1 до 6.', tag:'×6', duration:3, choice:1 },
  { id:'plinko', name:'Plinko', description:'Параллельные запуски шаров', caption:'Запускайте шары и смотрите, куда они попадут.', tag:'до ×29', duration:3.8, choice:'standard' },
  { id:'roulette', name:'Roulette', description:'Красное, чёрное, зеро', caption:'37 секторов. Собственное распределение выбранной ставки.', tag:'до ×36', duration:6, choice:'red' },
  { id:'upgrader', name:'Upgrader', description:'Взлом терминала', caption:'Выберите множитель перед началом раунда.', tag:'до ×8', duration:4.4, choice:2 },
  { id:'slots', name:'Bonanza', description:'Каскады и бесплатные вращения', caption:'Собирайте одинаковые символы.', tag:'×100', duration:0 },
  { id:'blackjack', name:'Blackjack', description:'Карты и двадцать одно', caption:'Доберите карту или завершите свой ход.', tag:'Blackjack 3:2', duration:0 },
  { id:'maskhouse', name:'Mask Hou$e', description:'Линии и закреплённые Wild', tag:'×40', duration:0 },
  { id:'lecipher', name:'LeXof', description:'Кластеры и золотые ячейки', tag:'×40', duration:0 },
]);
