import { Router, Request, Response } from 'express';
import { FeedItem } from '../models/FeedItem';
import { requireAuth } from '../../users/routes/auth.router';
import * as AWS from '../../../../aws';


const router: Router = Router();

// Get all feed items
router.get('/', async (req: Request, res: Response) => {

    const items = await FeedItem.findAndCountAll({order: [['id', 'DESC']]}); 

    // Get a signed url for each 'FeedItem' entry in the database, and replace the 'url' property with the 'Pre-Signed URL' from S3
    // FeedItem: { id: 2, caption: 'Goodbye', url: 'test.jpg', createdAt: 2020-04-02T15:06:23.009Z, updatedAt: 2020-04-02T15:06:23.009Z }
    /* SignedURL: https://udagram-sergio-dev.s3.us-east-2.amazonaws.com/test.jpg?
        X-Amz-Algorithm=AWS4-HMAC-SHA256&
        X-Amz-Credential=AKIA5F3RNIJMSGNJD3FZ%2F20200405%2Fus-east-2%2Fs3%2Faws4_request&
        X-Amz-Date=20200405T212352Z&
        X-Amz-Expires=300&
        X-Amz-Signature=7706f46ab755796a6061d31cb668e622366f5c8b76a120d247dad2dad5c05763&
        X-Amz-SignedHeaders=host
    */
    items.rows.map((item) => {  
            if(item.url) {
                item.url = AWS.getGetSignedUrl(item.url);
            }
    });
    res.send(items);
});

//@TODO
//Add an endpoint to GET a specific resource by Primary Key
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
    const { id } = req.params 

    const item: FeedItem = await FeedItem.findByPk(id)

    if (item === null) {
        return res.status(404).send('Item not found')
    }    

    res.status(200).send(item)
})

// update a specific resource
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
        //@TODO try it yourself
        const { id } = req.params 
        const { caption, url } = req.body 

        const item : FeedItem = await FeedItem.findOne({ where: { id: id }})

        if (item === null) {
            return res.status(404).send({ error: "item not found"})
        }

        if (caption) {
            item['caption'] = caption
        }

        if (url) {
            item['url'] = url
        }
        
        await item.save()

        res.status(400).send(item)
});


// Get a signed url to put a new item in the bucket
router.get('/signed-url/:fileName', requireAuth, async (req: Request, res: Response) => {

    let { fileName } = req.params;

    const url = AWS.getPutSignedUrl(fileName);
    
    res.status(201).send({url: url});
});

// Post meta data and the filename after a file is uploaded 
// NOTE the file name is they key name in the s3 bucket.
// body : {caption: string, fileName: string};
router.post('/', requireAuth, async (req: Request, res: Response) => {
  
    const caption = req.body.caption;
    const fileName = req.body.url;

    // check Caption is valid
    if (!caption) {
        return res.status(400).send({ message: 'Caption is required or malformed' });
    }

    // check Filename is valid
    if (!fileName) {
        return res.status(400).send({ message: 'File url is required' });
    }

    const item: FeedItem = await new FeedItem({
            caption: caption,
            url: fileName
    });

    const saved_item = await item.save();

    saved_item.url = AWS.getGetSignedUrl(saved_item.url);
    res.status(201).send(saved_item);
});

export const FeedRouter: Router = router;