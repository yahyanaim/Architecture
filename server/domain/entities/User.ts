export class User {
  constructor(
    public readonly id: string,
    public name: string,
    public email: string,
    public readonly createdAt: Date,
    public isActive: boolean = true
  ) {}

  // Domain logic example: Encapsulating behavior
  changeName(newName: string) {
    if (newName.length < 3) {
      throw new Error("Name must be at least 3 characters long");
    }
    this.name = newName;
  }

  toggleActiveStatus() {
    this.isActive = !this.isActive;
  }
}
