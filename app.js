const express = require('express');
const { Sequelize } = require("sequelize");
const { Op } = require('sequelize');
const item = require('./models/item');
const cors = require('cors');
const QRCode = require('qrcode')
const fs = require('fs');
const fsPromises = require('fs').promises;
const PDFDocument = require('pdfkit');
const path = require('path');
const app = express();
app.use('/images', express.static('qr-codes'));
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 8000;
const host = process.env.HOST || '91.107.125.203';
const sequelize = new Sequelize({
    dialect: "sqlite",
    storage: "inventarisation.db",
    define: {
      timestamps: false
    }
  });
  const Item = require('./models/item')(sequelize);

sequelize.sync().then(()=>{
    app.listen(port, host, () => {
        console.log(`Сервер начал прослушивание запросов на порту ${port}`);
    });
  }).catch(err=>console.log(err));

  app.get('/', (req, res) => {
    res.send('helloWorld');
});

app.get('/deleteItem', (req, res) => {
  Item.destroy({
    where: {
      id: req.query.id
    }
  });
  res.status(200).end();
});

app.get('/listItems', (req, res) => {
  const { query } = req;

  let filter = {};

  if (query.searchQuery) {
    filter = {
      [Op.or]: [
        { type: { [Op.like]: '%' + query.searchQuery + '%' } },
        { title: { [Op.like]: '%' + query.searchQuery + '%' } },
        { model: { [Op.like]: '%' + query.searchQuery + '%' } },
        { serialNumber: { [Op.like]: '%' + query.searchQuery + '%' } },
        { invNumber: { [Op.like]: '%' + query.searchQuery + '%' } },
        { status: { [Op.like]: '%' + query.searchQuery + '%' } },
        { description: { [Op.like]: '%' + query.searchQuery + '%' } },
        { user: { [Op.like]: '%' + query.searchQuery + '%' } },
        { roomNumber: { [Op.like]: '%' + query.searchQuery + '%' } },
      ]
    };
  }
  if (query.filter && query.filter!== "Все") {
    filter.status = query.filter;
  };

  Item.findAll({
    where: filter
  }).then(result => {
    res.send(result);
  });
});

app.post('/create', async (req, res) => {
  console.log(req.body);
  try {
    const qrCodeUrl = await generateQrCode(req.body.invNumber); 
    req.body.qrCode = qrCodeUrl; 
    const item = await Item.create(req.body); 
    res.status(200).json(item);
  } catch (error) {
    console.error('Ошибка при создании элемента:', error);
    res.status(500).send({ error: 'Ошибка при создании элемента' });
  }
});

app.get('/item', async (req, res) => {
 const result = await Item.findByPk(req.query.id);
 console.log(result);
 res.send(result);
});

app.post('/update', async (req, res) => {
  const qrCodeUrl = await generateQrCode(req.body.invNumber); 
    req.body.qrCode = qrCodeUrl; 
  Item.update(req.body, {
     where: {
       id: req.body.id
     }
  })
  .then(result => {
     res.status(200).send({ message: 'Запись обновлена' });
  })
  .catch(error => {
     console.error(error);
     res.status(500).send({ message: 'Ошибка обновления записи' });
  });
 });

async function generateQrCode(text) {
  try {
    const url = await QRCode.toDataURL(text);
    return url;
  } catch (error) {
    console.error('Ошибка при создании QR-кода:', error);
  }
};
 
 async function getQrCodesFromDatabase(selectedIds) {
   try {
    
    const items = await Item.findAll({
      where: {
        id: {
          [Op.in]: selectedIds // Используем оператор IN для фильтрации по нескольким ID
        }
      },
      attributes: ['title', 'invNumber','model', 'qrCode'] // Выбираем необходимые атрибуты
    });
     return items;
   } catch (error) {
     console.error('Ошибка при получении QR-кодов из базы данных:', error);
   }
 }
 
 async function createPdfWithQrCodes(selectedIds) {
  try {
    const fontPath = 'aqum2.otf';
    const qrCodes = await getQrCodesFromDatabase(selectedIds);
    const margin = 10; 
    const imageSize = 75;
    let doc = new PDFDocument({ size: "A4", margin });
    doc.registerFont('aqum2', fontPath);
    doc.font('aqum2');
    doc.pipe(fs.createWriteStream('qrcodes.pdf'));
    const pageWidth = 600;  
    let currentY = margin; 
    let currentPage = 0; 

    qrCodes.forEach((item, index) => {
      console.log(`Processing QR code ${index}:`, item.qrCode);
      const qrImageBuffer = Buffer.from(item.qrCode.split(",")[1], 'base64');

      // Проверка, достаточно ли места на текущей странице
      if (currentY + 150 > pageWidth) {
        doc.addPage();
        currentPage++;
        currentY = margin; 
      }

      const x = index % 2 === 0 ? margin : pageWidth / 2 + margin;
      doc.image(qrImageBuffer, x,  margin + currentY, { width: imageSize });

      const imageMargin = margin + imageSize;
      const textX = index % 2 === 0 ? imageMargin : pageWidth / 2 + imageMargin;
      let textY = currentY + 22;
      doc.font('aqum2')
      .fontSize(11)
      .fillColor('#000000')
      .text(`Инв. номер: ${item.invNumber}`, textX, textY);
      textY += 17;

      doc.font('aqum2')
      .fontSize(11)
      .fillColor('#000000')
      .text(`Название: ${item.title}`, textX, textY);
      textY += 17;

      doc.font('aqum2')
      .fontSize(11)
      .fillColor('#000000')
      .text(`Модель: ${item.model}`, textX, textY);
      currentY += index % 2 !== 0 ? imageSize + margin: 0; 
    });

    doc.end();
    console.log(`Found ${qrCodes.length} QR codes.`);
  } catch (error) {
    console.error('Ошибка при создании PDF с QR-кодами:', error);
  }
}

async function convertPdfToBase64(filePath) {
  try {
    // Используйте fsPromises.readFile вместо fs.readFile
    const buffer = await fsPromises.readFile(filePath);
    // Конвертация буфера в строку Base64
    const base64String = buffer.toString('base64');
    return base64String;
  } catch (error) {
    console.error('Ошибка при преобразовании PDF в Base64:', error);
    throw error;
  }
}

app.post('/download', async (req, res) => {
  try {
    const selectedIds = req.body.ids;
    console.log(selectedIds);
    await createPdfWithQrCodes(selectedIds); // Создаем PDF с QR-кодами
    const filePath = path.join(__dirname, 'qrcodes.pdf');
    const base64String = await convertPdfToBase64(filePath); // Преобразуем PDF в Base64
    res.send(base64String); // Отправляем Base64-строку
  } catch (error) {
    console.error('Ошибка при создании и отправке PDF файла:', error);
    res.status(500).send({ error: 'Ошибка при создании PDF файла' });
  }
});

async function getPdfFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size; // Размер файла в байтах
  } catch (error) {
    console.error(`Ошибка при получении размера файла ${filePath}:`, error);
    throw error;
  }
}