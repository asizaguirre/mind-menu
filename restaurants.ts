import { Router, Request, Response } from 'express';
import Restaurant from '../models/Restaurant';
import { createRestaurantService } from '../utils/railwayManager';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, ownerEmail } = req.body;
    
    const restaurant = new Restaurant({ name, ownerEmail });
    await restaurant.save();

    const railwayService = await createRestaurantService(name);
    res.json({ 
      message: 'Restaurante criado e serviço publicado no Railway', 
      restaurant,
      railwayService
    });
  } catch (err: any) {
    res.status(500).json({ message: 'Erro ao criar serviço no Railway', error: err.message });
  }
});

export default router;