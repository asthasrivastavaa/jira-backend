import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {}

  async create(data: { name: string; email: string; passwordHash: string }) {
    try {
      return await this.userModel.create(data);
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException('An account with this email already exists');
      }
      throw err;
    }
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() });
  }

  findByEmailWithPassword(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+passwordHash');
  }

  findById(id: string) {
    return this.userModel.findById(id);
  }

  findByIds(ids: string[]) {
    return this.userModel.find({ _id: { $in: ids } });
  }

  markEmailVerified(id: string) {
    return this.userModel.updateOne({ _id: id }, { isEmailVerified: true });
  }

  updateUnverified(id: string, data: { name: string; passwordHash: string }) {
    return this.userModel.updateOne({ _id: id, isEmailVerified: false }, data);
  }
  
  async updateEmail(id: string, email: string) {
    try {
      await this.userModel.updateOne({ _id: id }, { email: email.toLowerCase().trim() });
    } catch (err: any) {
      // someone else took the address between the request and the confirmation
      if (err?.code === 11000) throw new ConflictException('That email is already in use');
      throw err;
    }
  }

  updatePassword(id: string, passwordHash: string) {
    return this.userModel.updateOne({ _id: id }, { passwordHash });
  }

}
