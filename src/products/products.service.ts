import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PrismaClient } from '@prisma/client';
import { PaginationDto } from 'src/common';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class ProductsService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger('ProductsService');

  onModuleInit() {
    this.$connect();
    this.logger.log('Database connected.');
  }

  create(createProductDto: CreateProductDto) {
    return this.product.create({
      data: createProductDto,
    });
  }

  async findAll(paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;
    const total_items = await this.product.count({
      where: { available: true },
    });
    const last_page = Math.ceil(total_items / limit);
    return {
      data: await this.product.findMany({
        skip: (page - 1) * limit,
        take: limit,
        where: {
          available: true,
        },
      }),
      meta: {
        page,
        last_page,
        total_items,
      },
    };
  }

  async findOne(id: number) {
    const product = await this.product.findUnique({
      where: {
        id,
        available: true,
      },
    });
    if (!product)
      throw new RpcException({
        message: `Product with ID: ${id} was not found.`,
        status: HttpStatus.BAD_REQUEST,
      });

    return product;
  }

  async update(id: number, updateProductDto: UpdateProductDto) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, ...data } = updateProductDto;

    //* refactor with a try and catch block instead of findOne,
    //* in order to avoid double query to DB.s
    await this.findOne(id);

    return this.product.update({
      where: {
        id,
      },
      data,
    });
  }

  async remove(id: number) {
    //* refactor with a try and catch block instead of findOne,
    //* in order to avoid double query to DB.s
    await this.findOne(id);

    const product = await this.product.update({
      where: {
        id,
      },
      data: {
        available: false,
      },
    });

    return product;
  }

  async validateProducts(ids: number[]) {
    //* eliminate duplicates
    ids = Array.from(new Set(ids));
    const products = await this.product.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    if (products.length !== ids.length) {
      const invalidIds = ids.filter(
        (id) => !products.some((product) => product.id === id),
      );
      throw new RpcException({
        message: `Products with IDs: ${invalidIds.join(', ')} were not found.`,
        status: HttpStatus.BAD_REQUEST,
      });
    }

    return products;
  }
}
